import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";
import { syncEmotions } from "./services/emotions";
import "./styles/global.css";

// Make the backend canonical for the emotion vocabulary. Not awaited: the local
// seed already renders correctly, so this only corrects labels/colours if the
// two sides have drifted.
syncEmotions();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);