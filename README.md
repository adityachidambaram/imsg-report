# iMessage Report

Explore stats for an iMessage group chat. The app reads the selected database
files in your browser; the chat and contacts databases are not uploaded.

## Run locally

```sh
npm ci
npm run dev
```

Create a production build with `npm run build`.

## Export a chat report

Open a group chat's **Reactions** tab and choose **Export PDF**. In the browser's
print dialog, select **Save as PDF**. The report title includes the group name
and date of its latest non-reaction message. It includes all identified people,
the six built-in reactions and up to four additional popular emojis. The rate
table includes only the reactions selected in the app. Sections appear in this
order: who texts the most, reaction rates, reactions received, and reactions
given.

## Publish on GitHub Pages

1. In the repository's **Settings → Pages**, set the source to **GitHub Actions**.
2. Commit and push to `main`. The workflow builds and deploys the site automatically.

Do not commit chat or contacts database files. They are ignored by `.gitignore`.
