import express from "express";

const app = express();

function Preview(props) {
  return <div>{props.dangerouslySetInnerHTML.__html}</div>;
}

app.get("/profile", function profile(req) {
  return <Preview dangerouslySetInnerHTML={{ __html: req.query.biography }} />;
});
