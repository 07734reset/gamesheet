// Reference lists supplied by the gamesheet manager.
const REF = {
 "goalCodes": [
  [
   "E",
   "Even Handed"
  ],
  [
   "PP",
   "Power Play"
  ],
  [
   "SH",
   "Short Handed"
  ],
  [
   "DP",
   "Delayed Penalty"
  ],
  [
   "PS",
   "Penalty Shootout"
  ],
  [
   "PG",
   "Penalty Goal"
  ],
  [
   "ENG",
   "Empty Net Goal"
  ]
 ],
 "leagues": [
  {
   "name": "U19 National",
   "period": "20:00",
   "ot": "05:00"
  },
  {
   "name": "U19 S1",
   "period": "20:00",
   "ot": "05:00"
  },
  {
   "name": "U19 S2",
   "period": "20:00",
   "ot": "05:00"
  },
  {
   "name": "U16 S1",
   "period": "15:00",
   "ot": "05:00"
  },
  {
   "name": "U16 S2",
   "period": "15:00",
   "ot": "05:00"
  },
  {
   "name": "U14 S1",
   "period": "15:00",
   "ot": "05:00"
  },
  {
   "name": "U14 S2",
   "period": "15:00",
   "ot": "05:00"
  },
  {
   "name": "U12 S1",
   "period": "18:00",
   "ot": "05:00"
  },
  {
   "name": "U12 S2",
   "period": "18:00",
   "ot": "05:00"
  }
 ],
 "penaltyCodes": [
  [
   "ABUSE",
   "Abuse of Officials"
  ],
  [
   "ADJ-E",
   "Adjustment of Equipment"
  ],
  [
   "ATT-B",
   "Attempt to Butt End"
  ],
  [
   "ATT-K",
   "Attempt to Kick"
  ],
  [
   "ATT-S",
   "Attempt to Spear"
  ],
  [
   "ALTRC",
   "Altercation"
  ],
  [
   "BENCH",
   "Bench Minor Penalty"
  ],
  [
   "BDYCH",
   "Body-check in Non-Contact Game"
  ],
  [
   "BOARD",
   "Boarding"
  ],
  [
   "BR-ST",
   "Broken Stick"
  ],
  [
   "BUT-E",
   "Butt Ending"
  ],
  [
   "CHARG",
   "Charging"
  ],
  [
   "CHE-B",
   "Checking from Behind"
  ],
  [
   "CLIP",
   "Clipping"
  ],
  [
   "CROSS",
   "Cross Checking"
  ],
  [
   "DAN-E",
   "Dangerous Equipment"
  ],
  [
   "DELAY",
   "Delaying the Game"
  ],
  [
   "DIS-N",
   "Displacing the Net"
  ],
  [
   "ELBOW",
   "Elbowing"
  ],
  [
   "EX-RP",
   "Excessive Rough Play"
  ],
  [
   "F-OFF",
   "Face Off Violation"
  ],
  [
   "FAL-P",
   "Falling on the Puck"
  ],
  [
   "FIGHT",
   "Fighting and Fisticuffs"
  ],
  [
   "GA-MI",
   "Game Misconduct Penalty"
  ],
  [
   "GR-MI",
   "Gross Misconduct Penalty"
  ],
  [
   "HANDP",
   "Hand Pass"
  ],
  [
   "H-BUT",
   "Head Butting"
  ],
  [
   "HI-ST",
   "High Sticks"
  ],
  [
   "HOLD",
   "Holding"
  ],
  [
   "HO-MA",
   "Holding the Face Mask"
  ],
  [
   "HO-ST",
   "Holding the Stick"
  ],
  [
   "HOOK",
   "Hooking"
  ],
  [
   "IL-EQ",
   "Illegal Equipment"
  ],
  [
   "IL-ST",
   "Illegal Stick"
  ],
  [
   "INTRF",
   "Interference"
  ],
  [
   "INT-S",
   "Interference with Spectators"
  ],
  [
   "KICK",
   "Kicking"
  ],
  [
   "KNEE",
   "Kneeing"
  ],
  [
   "L-CRE",
   "Leaving the Crease"
  ],
  [
   "L-PEB",
   "Leaving Penalty Bench"
  ],
  [
   "L-PLB",
   "Leaving Players Bench"
  ],
  [
   "MATCH",
   "Match Penalty"
  ],
  [
   "MISC",
   "Misconduct Penalty (10 min.)"
  ],
  [
   "MOLST",
   "Molesting Officials"
  ],
  [
   "OBS-L",
   "Obscene Language"
  ],
  [
   "PEN-S",
   "Penalty Shot"
  ],
  [
   "P-FRE",
   "Freezing the Puck"
  ],
  [
   "P-HOL",
   "Holding the Puck"
  ],
  [
   "P-OUT",
   "Puck Out of Bounds"
  ],
  [
   "REFUS",
   "Refusing to Start Play"
  ],
  [
   "ROUGH",
   "Roughing"
  ],
  [
   "SLASH",
   "Slashing"
  ],
  [
   "SPEAR",
   "Spearing"
  ],
  [
   "STA-L",
   "Starting Line Up"
  ],
  [
   "THR-P",
   "Throwing the Puck"
  ],
  [
   "THR-S",
   "Throwing the Stick"
  ],
  [
   "TOO-M",
   "Too Many Players"
  ],
  [
   "TRIP",
   "Tripping"
  ],
  [
   "UN-SP",
   "Unsportsmanlike Conduct"
  ],
  [
   "UNN-R",
   "Unnecessary Roughing"
  ]
 ],
 "penaltyTypes": [
  {
   "label": "2",
   "name": "Minor Penalty",
   "pim": 2
  },
  {
   "label": "4",
   "name": "Double Minor (2 x 2)",
   "pim": 4
  },
  {
   "label": "5",
   "name": "Major Penalty",
   "pim": 5
  },
  {
   "label": "10",
   "name": "Misconduct Penalty",
   "pim": 10
  },
  {
   "label": "Game",
   "name": "Game Misconduct (Ejection 10+5)",
   "pim": 15
  },
  {
   "label": "Match",
   "name": "Match Penalty (Ejection 20+5)",
   "pim": 25
  }
 ]
};
