// Déclenche le cron des rappels en local, comme le ferait Vercel Cron chaque matin.
const reponse = await fetch(`${process.env.APP_URL}/api/cron/rappels`, {
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
});
console.log(reponse.status, await reponse.text());
