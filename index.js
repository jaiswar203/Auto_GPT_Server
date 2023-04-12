const express=require("express")
const http=require("http")
const WebSocket=require("ws")
const {Client}=require("ssh2")
const path=require("path")
const fs=require("fs")
const dotenv=require("dotenv")

dotenv.config({path:"./.env"})

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const activeStreams = new Map();



wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    // Check if the message is valid JSON
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message);
    } catch (error) {
      // If the message is not valid JSON, assume it's regular terminal input and write it to the stream
      const stream = activeStreams.get(ws);
      if (stream) {
        stream.write(message);
      }
      return;
    }

    // Process JSON messages
    if (parsedMessage.type === "connection") {
      const { host, username } = parsedMessage;

      const conn = new Client();
      conn
        .on("ready", () => {
          conn.shell((err, stream) => {
            if (err) {
              ws.close();
              return;
            }
            
            stream.write("sudo su\n");
            stream.write("cd /home/ubuntu/Auto-GPT\n");
            stream.write("python3 scripts/main.py\n");
            stream.write("y\n");

            // Store the stream in a variable accessible outside of this callback
            activeStreams.set(ws, stream);

            stream.on("data", (data) => {
              ws.send(data);
            });

            stream.on("end", () => {
              conn.end();
              activeStreams.delete(ws);
            });
          });
        })
        .on("error", (error) => {
            console.log({error})
          ws.close();
        })
        .connect({
          host,
          username,
          privateKey: fs.readFileSync("./maukav1.pem"),
        });
    }
  });
});

const PORT = process.env.PORT || 3001;

if(process.env.NODE_ENV==="prodcution"){
  app.use(express.static(path.join('/home/ubuntu/server',"/","public")));

  app.get("*", (_, res) => {
    const filePath = path.join("/home/ubuntu/server", "../", "public/index.html");
    res.sendFile(filePath);
  });
}

server.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
