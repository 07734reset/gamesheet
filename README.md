# Ice hockey gamesheet

A web app for filling in a UK junior ice hockey game sheet during a game and printing it for the referee to sign.

- Works on any phone, iPad or computer. Add it to your home screen, and it works offline after the first visit.
- Pre-game: teams, date, time, venue, league (sets the period length).
- Rosters can be typed or read from a photo of the team list. The photo is read on the device.
- Goals and penalties are entered with the period and the time on the rink clock. The app converts the countdown clock into time since the start of play.
- Penalty start and end times are worked out automatically, including back-to-back penalties and minors ended early by a power-play goal. Every time can be overridden.
- Prints one A4 landscape page in the standard game sheet layout.

All game data stays on the device that entered it.

Photo reading uses [tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0), bundled in `vendor/tesseract`.
