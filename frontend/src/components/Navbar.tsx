import React from "react";
import "./Navbar.css";
// ⚡
export const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="logo">
          <img src="./feedsense.png" alt="img" />
          FEEDSENSE <span className="navbar-text">| TMS DERIVATIVE</span>
        </div>
        {/* <ul className={`nav-link `}>
          <li>
            <a href="#" className="nav-links">
              Home
            </a>
          </li>
          <li>
            <a href="#" className="nav-links">
              Trades
            </a>
          </li>
        </ul> */}
        {/* <button></button> */}
        {/* <div
          className="hamburger"
          id="hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </div> */}
      </div>
    </nav>
  );
};

// export const Navbar = ({
//   menuOpen,
//   setMenuOpen,
// }: {
//   menuOpen: boolean;
//   setMenuOpen: any;
// }) => {

{
  /* <ul className={`nav-link ${menuOpen ? "open" : ""}`}> */
}
