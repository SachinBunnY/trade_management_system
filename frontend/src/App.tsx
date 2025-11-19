import React from "react";
import "./App.css";
import { Routes, Route } from "react-router-dom";
import { HomePage } from "./components/HomePage";
import { Navbar } from "./components/Navbar";

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </>
  );
}

export default App;
