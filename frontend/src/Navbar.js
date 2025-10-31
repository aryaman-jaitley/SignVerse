import React from "react";
import "./Navbar.css";

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-logo">SignVerse</div>
      <div className="navbar-links">
        <a href="#home">Home</a>
        <a href="#features">Features</a>
        <a href="#modes">Modes</a>
        <a href="#about">About</a>
      </div>
    </nav>
  );
};

export default Navbar;
