import React from 'react';
import './App.css';
import Piano from './piano';

function App() {
        // Add this inside the App component
if (window.cv) {
  console.log("OpenCV is loaded!");
} else {
  console.log("OpenCV is loading...");
}
  return (
    <div className="App">
      <Piano />
    </div>
  );
}

export default App;