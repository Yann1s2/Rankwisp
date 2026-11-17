import { openDB } from "./db.mjs";
import { createApp } from "./app.mjs";
import express from "express";
import { resolve } from "node:path";
const db = openDB(process.env.DB_PATH || ".data/rankwisp.sqlite");
const app = createApp(db);
app.use(express.static(resolve("dist")));
app.get("/{*path}", (_q, res) => res.sendFile(resolve("dist/index.html")));
const server = app.listen(
  Number(process.env.PORT || 4318),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      "Rankwisp server ready at " +
        (process.env.PUBLIC_ORIGIN || "http://127.0.0.1:4318"),
    ),
);
const timer = setInterval(() => app.locals.tick(), 60000);
timer.unref();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
