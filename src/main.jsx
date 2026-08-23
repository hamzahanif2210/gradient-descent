import React from "react";
import ReactDOM from "react-dom/client";
import GradientDescentV4 from "../gradient-descent-v4.jsx";
// v3 is still available for reference/rollback: ../gradient-descent-v3.jsx
// v1 is still available for reference/rollback: ../gradient-descent.jsx

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GradientDescentV4 />
  </React.StrictMode>
);
