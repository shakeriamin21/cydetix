import cors from "cors";
import express from "express";

const app = express();

// Browsers reject credentialed responses with Access-Control-Allow-Origin: *.
// This is a configuration error, but it is not evidence of arbitrary-origin credential access.
app.use(cors({ origin: "*", credentials: true }));
