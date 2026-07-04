import React from 'react';
import './Background3D.css';

export default function Background3D() {
  return (
    <div className="bg3d-container">
      {/* 1. Faint grid overlay */}
      <div className="bg3d-grid"></div>

      {/* 2. Radial vignette depth layer */}
      <div className="bg3d-vignette"></div>

      {/* 3. Floating 3D shapes */}
      <div className="bg3d-shape shape-square"></div>
      <div className="bg3d-shape shape-circle"></div>
      <div className="bg3d-shape shape-triangle">
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <polygon points="50,15 90,85 10,85" />
        </svg>
      </div>
      <div className="bg3d-shape shape-line"></div>
      <div className="bg3d-shape shape-square-2"></div>
    </div>
  );
}
