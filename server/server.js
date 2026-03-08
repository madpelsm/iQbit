const express = require("express");
const app = express(); // create express app
const { createProxyMiddleware } = require("http-proxy-middleware");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const YTS_MIRRORS = [
  "https://yts.mx/api/v2/",
  "https://yts.am/api/v2/",
  "https://yts.ag/api/v2/",
  "https://yts.lt/api/v2/",
  "https://yts.pm/api/v2/",
  "https://yts.bz/api/v2/",
];

function requestJSON(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;

    const req = client.get(
      url,
      {
        timeout: 6000,
        headers: {
          "User-Agent": "iQbit-Server/1.0",
          Accept: "application/json",
        },
      },
      (resp) => {
        const { statusCode, headers } = resp;

        if (
          statusCode &&
          statusCode >= 300 &&
          statusCode < 400 &&
          headers.location &&
          redirectsLeft > 0
        ) {
          const redirectURL = new URL(headers.location, url).toString();
          resp.resume();
          resolve(requestJSON(redirectURL, redirectsLeft - 1));
          return;
        }

        if (!statusCode || statusCode >= 400) {
          const err = new Error(`Request failed with status ${statusCode}`);
          err.statusCode = statusCode;
          resp.resume();
          reject(err);
          return;
        }

        let raw = "";
        resp.setEncoding("utf8");
        resp.on("data", (chunk) => {
          raw += chunk;
        });
        resp.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Request timeout"));
    });
    req.on("error", reject);
  });
}

async function fetchYTSListMovies(query) {
  const queryString = new URLSearchParams(query).toString();
  let lastError;

  for (const mirror of YTS_MIRRORS) {
    try {
      const url = `${mirror}list_movies.json${queryString ? `?${queryString}` : ""}`;
      const response = await requestJSON(url);
      if (response && response.data) {
        return response;
      }
    } catch (err) {
      lastError = err;
      console.warn(`YTS mirror failed in server proxy: ${mirror}`, err.message);
    }
  }

  throw lastError || new Error("All YTS mirrors failed");
}

app.use(express.static("../release/public"));

app.get(["/yts/list_movies.json", "/yts/api/v2/list_movies.json"], async (req, res) => {
  try {
    const data = await fetchYTSListMovies(req.query);
    res.json(data);
  } catch (err) {
    res.status(502).json({
      status: "error",
      message: err.message || "YTS proxy failed",
    });
  }
});

app.use(
  "/api",
  createProxyMiddleware({
    target: process.env.QBIT_HOST || 'http://localhost:8080',
    changeOrigin: true,
    headers: {
      referer: process.env.QBIT_HOST || 'http://localhost:8080',
    },
  })
);

app.listen(parseInt(process.env.STANDALONE_SERVER_PORT || '8081'), () => {
  console.log(`server started on port ${process.env.STANDALONE_SERVER_PORT || '8081'}`);
});
