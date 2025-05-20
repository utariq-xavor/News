const Parser = require("rss-parser");
const fetch = require("node-fetch");
const { extract } = require("@extractus/article-extractor");

const parser = new Parser();

// ✅ Extract real article URL from Google redirect
function getActualLink(googleUrl) {
  try {
    const match = googleUrl.match(/url=([^&]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    return googleUrl;
  } catch (err) {
    return googleUrl;
  }
}

// ✅ Use Extractus to fetch readable article content
async function extractArticleBody(url) {
  try {
    const result = await extract(url);
    return result?.content
      ? result.content.replace(/<[^>]+>/g, "").slice(0, 5000)
      : "No article content found.";
  } catch (err) {
    console.error("Extractus error for:", url, "|", err.message);
    return "Failed to extract article body.";
  }
}

module.exports = async (req, res) => {
  // ✅ Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const query = req.query.q || "PPP Pakistan";
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-PK&gl=PK&ceid=PK:en`;

  try {
    const feed = await parser.parseURL(rssUrl);

    const articles = await Promise.all(
      feed.items.slice(0, 5).map(async (item) => {
        const realUrl = getActualLink(item.link);
        const fullArticle = await extractArticleBody(realUrl);

        return {
          title: item.title,
          link: realUrl,
          pubDate: item.pubDate,
          snippet: item.contentSnippet || item.content,
          source: item.creator || item.source || "Unknown",
          fullArticle
        };
      })
    );

    res.status(200).json({
      query,
      total: articles.length,
      articles
    });
  } catch (err) {
    console.error("News API error:", err.message);
    res.status(500).json({
      error: "News fetch failed",
      message: err.message
    });
  }
};
