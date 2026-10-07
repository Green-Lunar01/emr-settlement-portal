import http from "node:http";
import "./auth";
import "./repository";
import "./entity";
import "./database";
import "./users";

const port = Number(process.env.PORT) || 4000;

http.createServer().listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
