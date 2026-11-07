# 🗳️ Kids Election

A pretend election for kids: they sign up, you print ballots with silly random
parties, and a poll worker scans the QR code on each ballot stub to check them in.

## Run it

```bash
npm install
npm start
```

The terminal prints the links. Use the network address (e.g. `http://192.168.x.x:3000`)
rather than `localhost` so phones and tablets on the same Wi-Fi can reach it,
and so the QR codes on the ballots work when scanned.

| Page | Who | What |
|---|---|---|
| `/` | Kids | Register to vote, meet the parties |
| `/admin` | Teacher (PIN) | Make random parties, manage voters, print ballots, count votes |
| `/results` | Everyone | Turnout + vote count; auto-refreshes, good for a projector |
| `/checkin/<code>` | Poll worker | Opened by scanning a ballot's QR code; marks that kid as voted |

## Voting day

1. In `/admin`, click **🎲 Make new random parties** until you like them, then **Print all ballots**.
2. Each kid colours in one circle, tears off the **voter stub** and hands it to the poll worker.
3. The poll worker scans the stub's QR code with a phone camera → "Thanks for voting!"
   (Scanning the same stub again says they already voted, so nobody votes twice.)
4. Open the ballot box and tap **+** for each ballot in the **Count the votes** section.
5. Put `/results` on the big screen. 🎉

The QR code sits on a tear-off stub, not the ballot itself, so votes stay secret,
just like a real election.

## Settings (environment variables)

| Variable | Default | |
|---|---|---|
| `PORT` | `3000` | |
| `ADMIN_PIN` | `1234` | Teacher PIN for `/admin` |
| `BASE_URL` | auto-detected LAN address | Used in the QR codes. Set this if you host it somewhere else |
| `PAPER` | `A4` | Use `LETTER` for US paper |
| `DB_FILE` | `./election.db` | |

Example: `ADMIN_PIN=4321 PAPER=LETTER npm start`
