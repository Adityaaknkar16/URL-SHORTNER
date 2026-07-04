import express from 'express';
import bcrypt from 'bcryptjs';
import Url from '../models/Url.js';
import Group from '../models/Group.js';

const router = express.Router();

// Middleware to extract X-User-ID header
const requireUser = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId || userId.trim() === '') {
    return res.status(401).json({ error: 'Unauthorized: Missing User Identity' });
  }
  req.userId = userId.trim();
  next();
};

// Helper to generate 6-character alphanumeric code
function generateShortCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Ensure Uncategorized group exists for this specific user
const ensureUncategorizedGroup = async (userId) => {
  const uncategorized = await Group.findOne({ id: 'uncategorized', userId });
  if (!uncategorized) {
    await Group.create({
      id: 'uncategorized',
      userId: userId,
      name: 'Uncategorized',
      color: 'slate',
      createdAt: new Date(),
      archived: false,
      shareId: 'share-uncategorized-' + userId.substring(0, 8) + '-' + Math.random().toString(36).substring(2, 6)
    });
  }
};

// @route   GET /api/groups
// @desc    Get all groups for user
router.get('/groups', requireUser, async (req, res) => {
  try {
    await ensureUncategorizedGroup(req.userId);
    const groups = await Group.find({ userId: req.userId }).sort({ createdAt: 1 });
    return res.json(groups);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// @route   POST /api/groups
// @desc    Create a new group for user
router.post('/groups', requireUser, async (req, res) => {
  const { id, name, color } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Group name is required' });
  }

  try {
    // Check if the user already has a group with this name (case-insensitive)
    const existing = await Group.findOne({
      userId: req.userId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    if (existing) {
      return res.status(400).json({ error: 'Group name already exists' });
    }

    const shareId = 'share-' + Math.random().toString(36).substring(2, 10);
    const newGroup = new Group({
      id: id || 'group-' + Math.random().toString(36).substring(2, 12),
      userId: req.userId,
      name: name.trim(),
      color: color || 'navy',
      shareId
    });

    await newGroup.save();
    return res.status(201).json(newGroup);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// @route   PATCH /api/groups/:id
// @desc    Archive/Unarchive/Update group
router.patch('/groups/:id', requireUser, async (req, res) => {
  const { id } = req.params;
  const { archived } = req.body;
  
  try {
    const group = await Group.findOne({ id, userId: req.userId });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (archived !== undefined) {
      group.archived = archived;
    }
    await group.save();
    return res.json(group);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// @route   DELETE /api/groups/:id
// @desc    Delete group and delete all links inside it
router.delete('/groups/:id', requireUser, async (req, res) => {
  const { id } = req.params;
  if (id === 'uncategorized') {
    return res.status(400).json({ error: 'Cannot delete default Uncategorized group' });
  }

  try {
    const group = await Group.findOne({ id, userId: req.userId });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    await Group.deleteOne({ id, userId: req.userId });
    await Url.deleteMany({ groupId: id, userId: req.userId });
    return res.json({ success: true, message: 'Group and its links deleted.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// @route   GET /api/links
// @desc    Get all shortened links for user
router.get('/links', requireUser, async (req, res) => {
  try {
    const links = await Url.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.json(links);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// @route   GET /api/validate-vanity
// @desc    Check if a vanity code is available (globally unique check)
router.get('/validate-vanity', requireUser, async (req, res) => {
  const { code } = req.query;
  if (!code || code.trim() === '') {
    return res.json({ valid: true });
  }

  const cleanCode = code.trim().toLowerCase();
  const cleanRegex = /^[a-zA-Z0-9\-]+$/;
  if (!cleanRegex.test(cleanCode)) {
    return res.json({ valid: false, error: 'invalid format' });
  }
  if (cleanCode.length < 3) {
    return res.json({ valid: false, error: 'too short' });
  }

  try {
    const collision = await Url.findOne({
      $or: [
        { shortCode: { $regex: new RegExp(`^${cleanCode}$`, 'i') } },
        { vanityCode: { $regex: new RegExp(`^${cleanCode}$`, 'i') } }
      ]
    });

    if (collision) {
      // Suggest random fallback
      const fallback = cleanCode + '-' + generateShortCode().substring(0, 3);
      return res.json({ valid: false, error: 'taken', suggestion: fallback });
    }

    return res.json({ valid: true });
  } catch (error) {
    return res.status(500).json({ error: 'Server Error' });
  }
});

// @route   POST /api/shorten
// @desc    Create a short URL
router.post('/shorten', requireUser, async (req, res) => {
  const { id, longUrl, vanityCode, groupId, qrCode, expiresAt, maxClicks, password, tags, shortCode } = req.body;

  if (!longUrl || longUrl.trim() === '') {
    return res.status(400).json({ error: 'URL is required.' });
  }

  try {
    const parsedUrl = new URL(longUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'URL must use http or https protocol.' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Invalid URL format. Include http:// or https://' });
  }

  try {
    let finalCode = '';
    
    if (vanityCode && vanityCode.trim() !== '') {
      const cleanVanity = vanityCode.trim().toLowerCase();
      // Check global collision
      const collision = await Url.findOne({
        $or: [
          { shortCode: { $regex: new RegExp(`^${cleanVanity}$`, 'i') } },
          { vanityCode: { $regex: new RegExp(`^${cleanVanity}$`, 'i') } }
        ]
      });

      if (collision) {
        return res.status(400).json({ error: 'Vanity code is already taken.' });
      }
      finalCode = cleanVanity;
    } else if (shortCode && shortCode.trim() !== '') {
      const cleanShort = shortCode.trim();
      const collision = await Url.findOne({
        $or: [
          { shortCode: cleanShort },
          { vanityCode: cleanShort }
        ]
      });
      if (collision) {
        // Fallback to generating a unique one if collision occurs
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 10) {
          finalCode = generateShortCode();
          const existing = await Url.findOne({
            $or: [
              { shortCode: finalCode },
              { vanityCode: finalCode }
            ]
          });
          if (!existing) {
            isUnique = true;
          }
          attempts++;
        }
        if (!isUnique) {
          return res.status(500).json({ error: 'Failed to generate unique code.' });
        }
      } else {
        finalCode = cleanShort;
      }
    } else {
      // Generate unique short code (global uniqueness check)
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        finalCode = generateShortCode();
        const existing = await Url.findOne({
          $or: [
            { shortCode: finalCode },
            { vanityCode: finalCode }
          ]
        });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }
      if (!isUnique) {
        return res.status(500).json({ error: 'Failed to generate unique code.' });
      }
    }

    const newUrl = new Url({
      id: id || 'link-' + Math.random().toString(36).substring(2, 12),
      userId: req.userId,
      longUrl: longUrl.trim(),
      shortCode: finalCode,
      vanityCode: vanityCode || undefined,
      qrCode: qrCode || '',
      groupId: groupId || 'uncategorized',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      maxClicks: maxClicks ? parseInt(maxClicks) : null,
      password: password ? await bcrypt.hash(password, 10) : null,
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
    });

    await newUrl.save();
    return res.status(201).json(newUrl);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// @route   POST /api/bulk-shorten
// @desc    Create multiple short URLs at once
router.post('/bulk-shorten', requireUser, async (req, res) => {
  const { urls, groupId } = req.body;
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls must be a non-empty array.' });
  }
  if (urls.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 URLs per bulk import.' });
  }

  const results = [];
  for (const rawUrl of urls) {
    const longUrl = String(rawUrl).trim();
    if (!longUrl) {
      results.push({ longUrl, success: false, error: 'Empty URL' });
      continue;
    }
    try {
      const parsedUrl = new URL(longUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        results.push({ longUrl, success: false, error: 'Invalid protocol' });
        continue;
      }
    } catch {
      results.push({ longUrl, success: false, error: 'Invalid URL format' });
      continue;
    }

    // Generate unique short code
    let finalCode = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      finalCode = generateShortCode();
      const existing = await Url.findOne({ $or: [{ shortCode: finalCode }, { vanityCode: finalCode }] });
      if (!existing) isUnique = true;
      attempts++;
    }

    if (!isUnique) {
      results.push({ longUrl, success: false, error: 'Could not generate unique code' });
      continue;
    }

    try {
      const newUrl = new Url({
        id: 'link-' + Math.random().toString(36).substring(2, 12),
        userId: req.userId,
        longUrl,
        shortCode: finalCode,
        qrCode: '',
        groupId: groupId || 'uncategorized',
      });
      await newUrl.save();
      results.push({ longUrl, success: true, shortCode: finalCode });
    } catch (err) {
      results.push({ longUrl, success: false, error: 'Save failed' });
    }
  }

  return res.status(201).json({ results });
});

// @route   POST /api/links/move
// @desc    Move link to different group
router.post('/links/move', requireUser, async (req, res) => {
  const { linkId, groupId } = req.body;
  if (!linkId || !groupId) {
    return res.status(400).json({ error: 'Link ID and Group ID are required.' });
  }

  try {
    const link = await Url.findOne({ _id: linkId, userId: req.userId });
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }
    
    link.groupId = groupId;
    await link.save();
    return res.json(link);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// @route   PATCH /api/links/:id
// @desc    Update a link's properties (longUrl, active, tags)
router.patch('/links/:id', requireUser, async (req, res) => {
  const { id } = req.params;
  const { longUrl, active, tags } = req.body;

  try {
    const link = await Url.findOne({ _id: id, userId: req.userId });
    if (!link) {
      return res.status(404).json({ error: 'Link not found or unauthorized' });
    }

    if (longUrl !== undefined) {
      // Validate new URL
      try {
        const parsed = new URL(longUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return res.status(400).json({ error: 'URL must use http or https protocol.' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid URL format.' });
      }
      link.longUrl = longUrl.trim();
    }

    if (active !== undefined) {
      link.active = active;
    }

    if (tags !== undefined) {
      link.tags = tags;
    }

    await link.save();
    return res.json(link);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// @route   DELETE /api/links/:id
// @desc    Delete a shortened link
router.delete('/links/:id', requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await Url.deleteOne({ _id: id, userId: req.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Link not found or unauthorized' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// @route   DELETE /api/links/group/:groupId
// @desc    Delete all links inside a specific group (or all) for user
router.delete('/links/group/:groupId', requireUser, async (req, res) => {
  const { groupId } = req.params;
  try {
    if (groupId === 'all') {
      await Url.deleteMany({ userId: req.userId });
    } else {
      await Url.deleteMany({ groupId, userId: req.userId });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// @route   GET /api/share/:shareId
// @desc    Get read-only group info and links (public access, no requireUser needed)
router.get('/share/:shareId', async (req, res) => {
  const { shareId } = req.params;
  try {
    const group = await Group.findOne({ shareId });
    if (!group) {
      return res.status(404).json({ error: 'Shared group not found' });
    }

    const links = await Url.find({ groupId: group.id, userId: group.userId }).sort({ createdAt: -1 });
    return res.json({ group, links });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});
// @route   GET /api/links/:id/analytics
// @desc    Get click events for a specific link
router.get('/links/:id/analytics', requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const link = await Url.findOne({ _id: id, userId: req.userId });
    if (!link) {
      return res.status(404).json({ error: 'Link not found or unauthorized' });
    }
    return res.json({ clickEvents: link.clickEvents || [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// @route   GET /api/links/:id/stats
// @desc    Get aggregated stats for a specific link
router.get('/links/:id/stats', requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const link = await Url.findOne({ _id: id, userId: req.userId });
    if (!link) {
      return res.status(404).json({ error: 'Link not found or unauthorized' });
    }

    const clickEvents = link.clickEvents || [];
    
    const devices = { Mobile: 0, Tablet: 0, Desktop: 0 };
    const browsers = { Chrome: 0, Safari: 0, Firefox: 0, Edge: 0, Opera: 0, Other: 0 };
    const referrersMap = {};
    const overTimeMap = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      overTimeMap[dateStr] = 0;
    }

    clickEvents.forEach(evt => {
      const dev = evt.device || 'Desktop';
      devices[dev] = (devices[dev] || 0) + 1;

      const br = evt.browser || 'Other';
      browsers[br] = (browsers[br] || 0) + 1;

      let ref = 'Direct/Unknown';
      if (evt.referrer) {
        try {
          ref = new URL(evt.referrer).hostname || evt.referrer;
        } catch {
          ref = evt.referrer;
        }
      }
      referrersMap[ref] = (referrersMap[ref] || 0) + 1;

      if (evt.timestamp) {
        const dateStr = new Date(evt.timestamp).toISOString().split('T')[0];
        if (overTimeMap[dateStr] !== undefined) {
          overTimeMap[dateStr] += 1;
        }
      }
    });

    const overTime = Object.keys(overTimeMap).sort().map(date => ({
      date,
      count: overTimeMap[date]
    }));

    const topReferrers = Object.keys(referrersMap)
      .map(ref => ({ name: ref, count: referrersMap[ref] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return res.json({
      totalClicks: link.clicks || 0,
      devices,
      browsers,
      topReferrers,
      overTime
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

export default router;
