const express = require("express");
const cors = require("cors");
const app = express();
const userRoutes = require("./controllers/userController");
const http = require("http");
const { initialize } = require("./socket");

app.use(cors()); // Enable CORS
app.use(express.json());
app.use("/", userRoutes);

const server = http.createServer(app);
const io = initialize(server); // Capture the returned io object

io.on("connection", (socket) => {
  console.log("Client connected");
});

server.listen(8080, () => {
  console.log("Server running on port 8080");
});
