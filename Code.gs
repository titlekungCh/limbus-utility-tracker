const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet               = ss.getSheetByName ('Inventory');
const dataSheet           = ss.getSheetByName ('DataSheet');
const lunacySheet         = ss.getSheetByName ('Lunacy');

//#region Cells Declaration
// const invData = sheet.getRange('H18:L22').getValues(); 
// const dsData  = dataSheet.getRange('J13:K39').getValues();
// const lunData = lunacySheet.getRange('A2:G2').getValues();

const hXMD                = sheet.getRange ('H20:K20').getValues();
const nXMD                = sheet.getRange ('H22:J22').getValues();
const leftXCell           = sheet.getRange ('H18:L18').getValues();
const invCell             = dataSheet.getRange('J13:J15').getValues();
const ticketXCell         = dataSheet.getRange('J30:J33').getValues();
const targetCell          = sheet.getRange      ('I8');
const nextLvlXPCell       = sheet.getRange      ('I9');
const hard1MD             = sheet.getRange     ('H20');
const hard2MD             = sheet.getRange     ('I20');
const hard3MD             = sheet.getRange     ('J20');
const normal1MD           = sheet.getRange     ('H22');
const normal2MD           = sheet.getRange     ('I22');
const normal3MD           = sheet.getRange     ('J22');
const rentalMD            = sheet.getRange     ('K20');
const dailyLeftCell       = sheet.getRange     ('H18');
const weeklyLeftCell      = sheet.getRange     ('I18');
const uptieSinnerCell     = sheet.getRange     ('L18');
const crateCell           = dataSheet.getRange ('J13');
const limPassCell         = dataSheet.getRange ('J14');
const threadCell          = dataSheet.getRange ('J15');
const ticket1Cell         = dataSheet.getRange ('J30');
const ticket2Cell         = dataSheet.getRange ('J31');
const ticket3Cell         = dataSheet.getRange ('J32');
const ticket4Cell         = dataSheet.getRange ('J33');
// const hard1MD             = hXMD[0][0];
// const hard2MD             = hXMD[0][1];
// const hard3MD             = hXMD[0][2];
// const normal1MD           = nXMD[0][0];
// const normal2MD           = nXMD[0][1];
// const normal3MD           = nXMD[0][2];
// const rentalMD            = hXMD[0][3];
const rentalWeek          = sheet.getRange     ('K22');   //0 = off, 1 = on
// const dailyLeftCell       = leftXCell[0][0];
// const weeklyLeftCell      = leftXCell[0][1];
// const uptieSinnerCell     = leftXCell[0][4];
const currentDayCell      = sheet.getRange     ('K14');
const gachaSinnerCell     = sheet.getRange     ('K16');
// const crateCell           = invCell[0][0];
// const limPassCell         = invCell[1][0];
// const threadCell          = invCell[2][0];
const dailyTCCell         = dataSheet.getRange ('J28');
// const ticket1Cell         = ticketXCell[0][0];
// const ticket2Cell         = ticketXCell[1][0];
// const ticket3Cell         = ticketXCell[2][0];
// const ticket4Cell         = ticketXCell[3][0];
const dailyLuxXP          = dataSheet.getRange ('J39');
const tLC                 = lunacySheet.getRange('A2');
const pLC                 = lunacySheet.getRange('B2');
const extTicCell          = lunacySheet.getRange('D2');
const decaExtTicCell      = lunacySheet.getRange('E2');
const currentDateCell     = lunacySheet.getRange('G1');
const intvEvntCrncyCell   = sheet.getRange     ('F12');
//#endregion
//#region Cells Range Declaration
const mdScheduleCells     = sheet.getRange               ('N17:N22');
const acq2StarRangeCell   = dataSheet.getRangeList  (['K10', 'K18']);
const acq3StarRangeCell   = dataSheet.getRangeList  (['K12', 'K20']);
const acqIDRangeCell      = dataSheet.getRangeList  (['K14', 'K22']);
const acqEGORangeCell     = dataSheet.getRangeList  (['K16', 'K24']);
const intervalloShop1     = sheet.getRangeList         ([ 'A9:G9' ]);
const intervalloShop2     = sheet.getRangeList         (['A11:F11']);
//#endregion
//#region Values Declaration
/**
 * @param {Date} date - the initial Date
 * @param {('Mon'|'Tue'|'Wed'|'Thurs'|'Fri'|'Sat'|'Sun')} day - the day of week
 * @returns {Date} - the Date of last occurrence or same Date if day param is invalid
 */
const days      = ['Sun', 'Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat'];
const lastThursday        = getLastDayOccurence (new Date(), 'Thurs');
let currentDay            = currentDayCell              .getValue  ();
let currentDate           = currentDateCell             .getValue  ();
let uptieSinner           = uptieSinnerCell             .getValue  ();
let gachaSinner           = gachaSinnerCell             .getValue  ();
let gachaTier             = sheet.getRange('L16')       .getValue  ();
let totalCrates           = Number(crateCell            .getValue ());
let curManXP              = Number(targetCell           .getValue ());
let nextLvlXP             = Number(nextLvlXPCell        .getValue ());
let dailyLuxXPNum         = Number(dailyLuxXP           .getValue ());
let limbusPassLevel       = Number(limPassCell          .getValue ());
let dThreadC              = Number(dailyTCCell          .getValue ());
let paidLunacy            = Number(pLC                  .getValue ());
let totalLunacy           = Number(tLC                  .getValue ());
let freeLunacy            = totalLunacy - paidLunacy;
let extTkt                = Number(extTicCell           .getValue ());
let decaExtTkt            = Number(decaExtTicCell       .getValue ());
let normalMDLeft          = Number(sheet.getRange('J18').getValue ());
let intvEvntCrncy         = Number(intvEvntCrncyCell    .getValue ());
// let dailyLeft             = dailyLeftCell.getValue();
// let weeklyLeft            = weeklyLeftCell.getValue();
// let acqID                 = acqIDRangeCell.getRanges();
// let acqEGO                = acqEGORangeCell.getRanges();
// let acq2Star              = acq2StarRangeCell.getRanges();
// let acq3Star              = acq3StarRangeCell.getRanges();
//#endregion
//#region Manager XP Management
function addDailyXP ()                  {   manXPAdd (dailyLuxXPNum);     chkManLvlUp(   'dailyXP');         }
function addNMDXP   ()/*addNormalMDXP*/ {   manXPAdd           (100);     chkManLvlUp('normalMDXP');         }
function addWBMDXP  ()/*addWeeklyMDXP*/ {   manXPAdd           (120);     chkManLvlUp('weeklyMDXP');         }
function undoDailyXP()                  {   manXPAdd(-dailyLuxXPNum);     chkManLvlUp( 'undoDaily');         }
function undoNMDXP  ()/*undoNormalMDXP*/{   manXPAdd          (-100);     chkManLvlUp('undoNormal');         }
function undoWBMDXP ()/*undoWeeklyMDXP*/{   manXPAdd          (-120);     chkManLvlUp('undoWeekly');         }
function add3HMD    ()/*addAll3HardMD*/ {   manXPAdd           (360);     chkManLvlUp(      '3hmd');         }
function undo3HMD   ()/*undo3HardMD  */ {   manXPAdd          (-360);     chkManLvlUp(     'u3hmd');         }
function addwNormal ()                  {   manXPAdd           (100);     chkManLvlUp(   'wnormal');         }
function undowNormal()                  {   manXPAdd          (-100);     chkManLvlUp(  'uwnormal');         }
function normalCheck(t)                 {   switch (t) {
  case '1':
    if      ( normal1MD.isChecked   ()      ) {                         normal1MD.uncheck();                 }
    else if ( normal2MD.isChecked   ()      ) {                         normal2MD.uncheck();                 }
    else if ( normal3MD.isChecked   ()      ) {                         normal3MD.uncheck();                 }
    else if ( rentalMD. isChecked   ()      ) {  if (rentalWeek == 0)   rentalMD .uncheck();                 }                    break;
  case '0':
    if      (!normal1MD.isChecked   ()      ) {                         normal1MD.  check();                 }
    else if (!normal2MD.isChecked   ()      ) {                         normal2MD.  check();                 }
    else if (!normal3MD.isChecked   ()      ) {                         normal3MD.  check();                 }
    else if (!rentalMD. isChecked   ()      ) {  if (rentalWeek == 0)   rentalMD .  check();                 }                    break;
}}
function chkManLvlUp(t)                 {   //checkManagerLevelUp(type)
  updateWeekDay     ();
  switch            (t)                 {
    case 'dailyXP'   : manualXPLux('normal'); threadAdd (dThreadC); limPassAdd (1, 1); wLPXP('normal');  fLCH(-26);               break;
    case 'normalMDXP': limPassAdd     (3, 1);   cloRS     ('J18', (normalMDLeft - 1));   /*- 1 MD normal left*/ normalCheck('1'); break;
    case 'weeklyMDXP': fLCH            (250);
    if        ( hard1MD.isChecked   ()      ) {  limPassAdd (7.5, 0);   crateAdd (21);  hard1MD.uncheck();   }
    else if   ( hard2MD.isChecked   ()      ) {  limPassAdd (8,   1);                   hard2MD.uncheck();   }
    else if   ( hard3MD.isChecked   ()      ) {  limPassAdd (9.5, 0);   crateAdd (27);  hard3MD.uncheck();   }                    break;
    case 'undoDaily' : manualXPLux  ('undo'); threadAdd(-dThreadC); limPassAdd(-1, 1); wLPXP  ('undo');  fLCH (26);               break;
    case 'undoNormal': limPassAdd    (-3, 1);   cloRS     ('J18', (normalMDLeft + 1));  /*- 1 MD normal left*/  normalCheck('0'); break;
    case 'undoWeekly': fLCH           (-250);
    if        (!hard3MD.isChecked   ()      ) {  limPassAdd(-9.5, 0);   crateAdd(-27);  hard3MD.check  ();   }
    else if   (!hard2MD.isChecked   ()      ) {  limPassAdd(-8,   1);                   hard2MD.check  ();   }
    else if   (!hard1MD.isChecked   ()      ) {  limPassAdd(-7.5, 0);   crateAdd(-21);  hard1MD.check  ();   }                    break;
    case '3hmd'      : fLCH           (750);     limPassAdd(22.5, 0);   crateAdd (67);   /* 3 Hard MD at once     */              break;
    case 'u3hmd'     : fLCH          (-750);     limPassAdd(-22.5, 0);  crateAdd(-67);   /* Undo 3 Hard MD at once*/              break;
    case 'wnormal'   : fLCH           (250);     limPassAdd (4.5, 1);   normalCheck('1');/* Weekly Normal MD      */              break;
    case 'uwnormal'  : fLCH          (-250);     limPassAdd(-4.5, 1);   normalCheck('0');/* Undo Weekly Normal MD */              break;
  } Utilities.sleep(500); chkExceedMax();
}
// function chkExceedMax() {  if (curManXP >= nextLvlXP) { targetCell.setValue(curManXP - nextLvlXP); addSelf('J9', 1); }} 
function chkExceedMax() {//  let cMXP = curManXP;
  let xp = Number(targetCell.getValue());
  let threshold = Number(nextLvlXPCell.getValue());
  if (xp >= threshold) {
    let remainingXP = xp - threshold;
    cloRS('I8', remainingXP);
    addSelf('J9', 1);
  }
}
//sheet.getRange('J9').setValue(collapseRV('J9') + 1);  } }
function manualXPLux(t) {
  // Grab all ticket values in ONE trip to the sheet
  const ticketValues = dataSheet.getRange('H30:H33').getValues(); 
  const multiplier = (t === 'normal') ? 1 : -1;

  // Process data locally in JS
  const amounts = {
    'I':   ticketValues[0][0] * multiplier,
    'II':  ticketValues[1][0] * multiplier,
    'III': ticketValues[2][0] * multiplier,
    'IV':  ticketValues[3][0] * multiplier
  };

  // Call tA with the pre-fetched data
  for (let type in amounts) {
    tA(type, amounts[type]);
  }
}
function weeklyModule(t, d, w, l, c, n) {     //t:type, d:daily, w:weekly, l:limpass, c:crate, n:temp
  switch             (t)                {
    case 'full'       :     dailyLeftCell.setValue(d);  weeklyLeftCell.setValue(w);    limPassAdd(l*n, 0);    crateAdd(c*n);      break;
    case 'noCrate'    :     dailyLeftCell.setValue(d);  weeklyLeftCell.setValue(w);    limPassAdd(l*n, 0);                        break;
    case 'dailyWeekly':     dailyLeftCell.setValue(d);  weeklyLeftCell.setValue(w);                                               break;
    case 'onlyDaily'  :     dailyLeftCell.setValue(d);                                                                            break;
  }
}
function  wLPXP(t)                      {  let x =  0;      //weeklyLimPassXP(type)    {let temp = 0;}
  if           (t == 'normal')          {  x     =  1; }   
  else if      (t == 'undo'  )          {  x     = -1; }
  switch       (currentDay   )          {
    case 'Thurs':  updateCurrentDate(); weeklyModule('full',        6, 2, 2.2, 6, x);    /*old value 6, 2, 1.1, 3*/               break;
    case 'Fri'  :                       weeklyModule('noCrate',     5, 1, 1.4, 6, x);    /*old value 5, 1, 0.4, 0*/               break;
    case 'Sat'  :                       weeklyModule('onlyDaily',   4, 1, 0,   0, x);                                             break;
    case 'Sun'  :                       weeklyModule('onlyDaily',   3, 1, 0,   0, x);                                             break;
    case 'Mon'  :                       weeklyModule('full',        2, 0, 1.4, 6, x);                                             break;
    case 'Tue'  :                       weeklyModule('onlyDaily',   1, 0, 0,   0, x);                                             break;
    case 'Wed'  :  mdCheckAll(x);       weeklyModule('dailyWeekly', 7, 5, 0,   0, x);    addSelf('K18', (-1*x));                  break;
    }
}
function mdCheckAll(t)                  {
  if        (t ==  1)     {   hard1MD  .check  ();  hard2MD  .check  ();    hard3MD  .check  (); 
  mdScheduleCells.uncheck();  normal1MD.check  ();  normal2MD.check  ();    normal3MD.check  (); }
  else if   (t == -1)     {   hard1MD  .uncheck();  hard2MD  .uncheck();    hard3MD  .uncheck();
  mdScheduleCells.check  ();  normal1MD.uncheck();  normal2MD.uncheck();    normal3MD.uncheck(); }
}
//#endregion
//#region Shard Update Function
function changeShard(shardType, sinner) {
  let sinnerTargetCell  = dataSheet.getRange(sinner);
  let currentShard      = Number(clDRV      (sinner));
  if      (shardType == '1Star'   )     {     sinnerTargetCell.setValue(currentShard +   3);   }
  else if (shardType == '2Star'   )     {     sinnerTargetCell.setValue(currentShard +  15);   }
  else if (shardType == '3Star'   )     {     sinnerTargetCell.setValue(currentShard +  50);   }
  else if (shardType == 'S3S'     )     {     sinnerTargetCell.setValue(currentShard - 400);   }
  else if (shardType == 'UT4'     )     {     sinnerTargetCell.setValue(currentShard -  50);   }
  else if (shardType == '2SUT4'   )     {     sinnerTargetCell.setValue(currentShard -  30);   }
  else if (shardType == '3SUT4'   )     {     sinnerTargetCell.setValue(currentShard -  50);   }
  else if (shardType == 'ZAYIN'   )     {     sinnerTargetCell.setValue(currentShard -  80);   }
  else if (shardType == 'TETH'    )     {     sinnerTargetCell.setValue(currentShard -  90);   }
  else if (shardType == 'HE'      )     {     sinnerTargetCell.setValue(currentShard - 100);   }
  else if (shardType == 'WAW'     )     {     sinnerTargetCell.setValue(currentShard - 150);   }
}
function sN2SC(sinner) {                 //sinnerNameToSinnerCell
  const sinnerMap = {
    'Yi Sang':     'J1',    'Faust':       'J2',    'Don Quixote': 'J3',    'Ryoshu':      'J4',
    'Meursault':   'J5',    'Hong Lu':     'J6',    'Heathcliff':  'J7',    'Ishmael':     'J8',
    'Rodion':      'J9',    'Sinclair':    'J10',   'Outis':       'J11',   'Gregor':      'J12'
  };
  // Return the mapped cell, or an empty string if not found
  return sinnerMap[sinner] || '';
}
//#region Old Update
function colRV      (cell)  {  return sheet.getRange    (cell).getValue(); }    //collapseRangeValue          (cell)
function clDRV      (cell)  {  return dataSheet.getRange(cell).getValue(); }    //collapseDatasheetRangeValue (cell)
function cloRS      (c, v)  {         sheet.getRange    (c)   .setValue(v);}    //collapseRangeSetValue       (cell, value)
function addSelf    (c, v)  {  cloRS      (c, colRV     (c) + v);          }
function ysUpdate   ()      {  changeShard(colRV     ('B36'), 'J1'  );     }
function ftUpdate   ()      {  changeShard(colRV     ('C36'), 'J2'  );     }
function dqUpdate   ()      {  changeShard(colRV     ('D36'), 'J3'  );     }
function rsUpdate   ()      {  changeShard(colRV     ('E36'), 'J4'  );     }
function msUpdate   ()      {  changeShard(colRV     ('F36'), 'J5'  );     }
function hlUpdate   ()      {  changeShard(colRV     ('G36'), 'J6'  );     }
function hcUpdate   ()      {  changeShard(colRV     ('H36'), 'J7'  );     }
function isUpdate   ()      {  changeShard(colRV     ('I36'), 'J8'  );     }
function rdUpdate   ()      {  changeShard(colRV     ('J36'), 'J9'  );     }
function scUpdate   ()      {  changeShard(colRV     ('K36'), 'J10' );     }
function otUpdate   ()      {  changeShard(colRV     ('L36'), 'J11' );     }
function ggUpdate   ()      {  changeShard(colRV     ('M36'), 'J12' );     }
//#endregion
//#region New Update
function xysUpdate  ()      {  changeShard(gachaTier,         'J1'  );     }
function xftUpdate  ()      {  changeShard(gachaTier,         'J2'  );     }
function xdqUpdate  ()      {  changeShard(gachaTier,         'J3'  );     }
function xrsUpdate  ()      {  changeShard(gachaTier,         'J4'  );     }
function xmsUpdate  ()      {  changeShard(gachaTier,         'J5'  );     }
function xhlUpdate  ()      {  changeShard(gachaTier,         'J6'  );     }
function xhcUpdate  ()      {  changeShard(gachaTier,         'J7'  );     }
function xisUpdate  ()      {  changeShard(gachaTier,         'J8'  );     }
function xrdUpdate  ()      {  changeShard(gachaTier,         'J9'  );     }
function xscUpdate  ()      {  changeShard(gachaTier,         'J10' );     }
function xotUpdate  ()      {  changeShard(gachaTier,         'J11' );     }
function xggUpdate  ()      {  changeShard(gachaTier,         'J12' );     }
//#endregion
//#endregion
//#region Day Management
function getLastDayOccurence (date, day){
  const d = new Date(date.getTime());
  if (days.includes(day))               {
    const modifier = (d.getDay() + days.length - days.indexOf(day)) % 7 || 7;
    d.setDate(d.getDate() - modifier);
  }
  return d;
}
function updateCurrentDate          ()  {   currentDateCell.setValue(lastThursday);                       }   //wait so day get properly set
function updateWeekDay              ()  {   cloRS     ('K14', days[(new Date().getDay())]);               }
//#endregion
//#region Inventory Add
function limPassAdd (level, noDecimal)  {   limPassCell.setValue(limbusPassLevel + level);
  if                (noDecimal == 1)    {   crateAdd            (level           * 3    );                }
}
function crateAdd             (amount)  {   crateCell .setValue (totalCrates     + amount              ); }
function manXPAdd (xp)/*managerXPAdd*/  {   targetCell.setValue (curManXP        + xp                  ); }
function threadAdd            (thread)  {   threadCell.setValue (Number(threadCell.getValue()) + thread); }
function tA(ticketType, amount)  {   //ticketAdd
  switch (ticketType)                   {
    case 'I'  :     ticket1Cell.setValue(Number(ticket1Cell.getValue()) + amount);                                                break;
    case 'II' :     ticket2Cell.setValue(Number(ticket2Cell.getValue()) + amount);                                                break;
    case 'III':     ticket3Cell.setValue(Number(ticket3Cell.getValue()) + amount);                                                break;
    case 'IV' :     ticket4Cell.setValue(Number(ticket4Cell.getValue()) + amount);                                                break;
  }
}
//#endregion
//#region Lunacy Management 65-13+52 = 104
function fLCH (a)                       {  tLC.setValue (totalLunacy + a);                               }   //freeLunacyChange(amount)
function pLCH (a)                       {  pLC.setValue (paidLunacy  + a);      fLCH(a);                 }   //paidLunacyChange(amount)
function evLCH(a)                       {  intvEvntCrncyCell.setValue(intvEvntCrncy + a);                }   //eventCurrencyChange(amount)
function monthlyPL        ()            {  pLCH (650);                                                   }
function freePull         ()            {  pLCH (-13);                                                   }
function mthlyFLunacy     ()            {  fLCH ( 65);                                                   }
function mf6513Lunacy     ()            {  pLCH (-13);                          fLCH(104)     ;/*why???*/}
function f300Lunacy       ()            {  fLCH (300);                                                   }
function f500Lunacy       ()            {  fLCH (500);                                                   }
function f800Lunacy       ()            {  fLCH (800);                                                   }
function f1300Lunacy      ()            {  fLCH(1300);                                                   }
function addPulls         (t)           {  extTicCell.setValue               (extTkt + t);               }   //type
function add10Pulls       (t)           {  decaExtTicCell.setValue       (decaExtTkt + t);               }   //type
function free10Pulls      ()            {  add10Pulls         (1);                                       }
function free1Sep         ()            {  addPulls           (1);                                       }
function free10Sep        ()            {  addPulls          (10);                                       }
function ut2_00           ()            {  threadAdd        (-10);                                       }
function ut3_00           ()            {  threadAdd        (-40);     fLCH(40);                         }
function ut4_00           ()            {  threadAdd(-100); changeShard('2SUT4',    sN2SC(uptieSinner)); }
function ut3_00Ft1        ()            {  threadAdd        (-50);     fLCH(40);                         }
function ut2_000          ()            {  threadAdd        (-20);                                       }
function ut3_000          ()            {  threadAdd        (-80);     fLCH(40);                         }
function ut4_000          ()            {  threadAdd(-150); changeShard('3SUT4',    sN2SC(uptieSinner)); }
function ut3_000Ft1       ()            {  threadAdd       (-100);     fLCH(40);                         }
function ut4_module       ()            {                              fLCH(40);                         }
function zayin2           ()            {  threadAdd        (-20);                                       }
function zayin3           ()            {  threadAdd        (-60);                                       }
function zayin3_1         ()            {  threadAdd        (-80);                                       }
function zayin4           ()            {  threadAdd(-110); changeShard('ZAYIN',    sN2SC(uptieSinner)); }
function teth2            ()            {  threadAdd        (-25);                                       }
function teth3            ()            {  threadAdd        (-70);                                       }
function teth3_1          ()            {  threadAdd        (-95);                                       }
function teth4            ()            {  threadAdd(-130); changeShard('TETH',     sN2SC(uptieSinner)); }
function he2              ()            {  threadAdd        (-30);                                       }
function he3              ()            {  threadAdd        (-80);                                       }
function he3_1            ()            {  threadAdd       (-110);                                       }
function he4              ()            {  threadAdd(-150); changeShard('HE',       sN2SC(uptieSinner)); }
function waw2             ()            {  threadAdd        (-35);                                       }
function waw3             ()            {  threadAdd        (-90);                                       }
function waw3_1           ()            {  threadAdd       (-125);                                       }
function waw4             ()            {  threadAdd(-170); changeShard('WAW',      sN2SC(uptieSinner)); }
function changeShardS     ()            {                   changeShard( gachaTier, sN2SC(gachaSinner)); }
function resding          (t, f)        {  //responding(text, function){}
  const uix = SpreadsheetApp.getUi();
  const response = uix.prompt(t, uix.ButtonSet.OK_CANCEL, );
  if (response.getSelectedButton() === uix.Button.OK) {
    switch (f)              {
      case 'addP':      addPulls          (Number(response.getResponseText()));                                                   break;
      case 'pLC' :      pLCH              (Number(response.getResponseText()));                                                   break;
      case 'plCx':      pullCx            (Number(response.getResponseText()));                                                   break;
    }
  }
}
function getCustomPulls  () {  resding    (  'How many Tickets'    ,'addP');  }
function customPaidLunacy() {  resding    (  'How many Paid Lunacy', 'pLC');  }
function pull10Pulls     () {
  if      (decaExtTkt >= 1)               {    add10Pulls         (-1);   }
  else if (extTkt     >= 10)              {    addPulls          (-10);   }
  else if (freeLunacy >= 1300)            {    fLCH            (-1300);   }
  else                                    {    catchError           ();   }
}
function pull1Pull       () {
  if      (extTkt     >= 1)               {    addPulls           (-1);   }
  else if (freeLunacy >= 130)             {    fLCH             (-130);   }
  else                                    {    catchError           ();   }
}
function pullingCustom   () {  resding    (   'How many pulls'    , 'plCx');}
function pullCx          (x){  let singles = x % 10; let tens = (x-singles)/10;
for (let i = 0; i <    tens; i++) {  pull10Pulls(); }
for (let j = 0; j < singles; j++) {  pull1Pull  (); }
}
function catchError      () {  SpreadsheetApp.getUi()  .alert('?????');       }
//#endregion
//#region Intervallo Event Shop
function extTicketFinish () {  addPulls   (       colRV('G2'));  cloRS('G9', colRV('G2')); evLCH( -200); }//20
function ivTickets       () {  tA         ('IV',  colRV('A2'));  cloRS('A9', colRV('A2')); evLCH(-1200); }//60
function iiiTickets      () {  tA         ('III', colRV('B2'));  cloRS('B9', colRV('B2')); evLCH( -100); }//20
function threadFinish    () {  threadAdd  (     5*colRV('C2'));  cloRS('C9', colRV('C2')); evLCH( -400); }//80
function crateFinish     () {  crateAdd   (     5*colRV('D2'));  cloRS('D9', colRV('D2')); evLCH( -150); }//10
function rCrateFinish    () {                                    cloRS('E9', colRV('E2')); evLCH( -100); }//10
function enkeBFinish     () {                                    cloRS('F9', colRV('F2')); evLCH( -150); }//6
function theRestFinish   () {  sheet.getRangeList(['A11:F11']).setValue(1); } //10, 10
function expTicketFinish () {  ivTickets   ();         iiiTickets();          }
function newSeason       () {  cloRS                    ('K18', 24);          }
function fullCourse      () {  mf6513Lunacy();         addDailyXP();          }
//#endregion
//#region Custom Menu
function onOpen          () {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Quick Buttons')
    .addItem   ('Day Updates',                  'cmenuDayUpdate'        )
    .addItem   ('Full Daily Schedule',          'fullCourse'            )
    .addSubMenu(ui.createMenu('Manager XP')
      .addItem('Daily Luxcavation',             'addDailyXP'          )
      .addItem('1 Normal MD Run',               'addNMDXP'            )
      .addItem('1 Weekly Bonus MD Run',         'addWBMDXP'           )
      .addItem('3 Hard MD at once',             'add3HMD'             )
      .addItem('1 Weekly Normal MD',            'addwNormal'          )
      .addSeparator()
      .addItem('Undo Daily Lux',                'undoDailyXP'         )
      .addItem('Undo Normal MD',                'undoNMDXP'           )
      .addItem('Undo Weekly Hard MD',           'undoWBMDXP'          )
      .addItem('Undo 3 Hard MD at once',        'undo3HMD'            )
      .addItem('Undo 1 Weekly Normal MD',       'undowNormal'         ) )
    .addSubMenu(ui.createMenu('Sinner Gacha Result')
      .addItem('Selected Sinner',               'changeShardS'        )
      .addItem('Yi Sang',                       'xysUpdate'           )
      .addItem('Faust',                         'xftUpdate'           )
      .addItem('Don Quixote',                   'xdqUpdate'           )
      .addItem('Ryoshu',                        'xrsUpdate'           )
      .addItem('Meursault',                     'xmsUpdate'           )
      .addItem('Hong Lu',                       'xhlUpdate'           )
      .addItem('Heathcliff',                    'xhcUpdate'           )
      .addItem('Ishmael',                       'xisUpdate'           )
      .addItem('Rodion',                        'xrdUpdate'           )
      .addItem('Sinclair',                      'xscUpdate'           )
      .addItem('Outis',                         'xotUpdate'           )
      .addItem('Gregor',                        'xggUpdate'           ) )
    .addSeparator()
    .addSubMenu(ui.createMenu('Extractions Menu')
      .addItem('Monthly Free Lunacy',           'mthlyFLunacy'        )
      .addItem('Daily Paid Pull',               'freePull'            )
      .addItem('Daily Paid Pull + Monthly Free','mf6513Lunacy'        )
      .addItem('Pulling 10 Pulls',              'pull10Pulls'         )
      .addItem('Pulling Single',                'pull1Pull'           )
      .addItem('Pulling Custom Amount',         'pullingCustom'       )
      .addSeparator()
      .addItem('300 Free Lunacy',               'f300Lunacy'          )
      .addItem('500 Free Lunacy',               'f500Lunacy'          )
      .addItem('800 Free Lunacy',               'f800Lunacy'          )
      .addItem('1300 Free Lunacy',              'f1300Lunacy'         )
      .addItem('650 Paid Lunacy',               'monthlyPL'           )
      .addItem('Custom Amount of Paid Lunacy',  'customPaidLunacy'    ) )
    .addSubMenu(ui.createMenu('Tickets Menu')
      .addItem('Free Deca Ticket',              'free10Pulls'         )
      .addItem('Free 10 Single Tickets',        'free10Sep'           )
      .addItem('Free 1 Single Tickets',         'free1Sep'            )
      .addItem('Add Custom Amount of Tickets',  'getCustomPulls'      ) )
    .addSubMenu(ui.createMenu('For Completing Intervallo Shop')
      .addItem('Intervallo Start',              'intervalloStart'     )
      .addSeparator()
      .addItem('Both Tickets (60) + (30)',      'expTicketFinish'     )
      .addItem('IV Tickets (60)',               'ivTickets'           )
      .addItem('III Tickets (20)',              'iiiTickets'          )
      .addItem('Threads (400)',                 'threadFinish'        )
      .addItem('Crates (50)',                   'crateFinish'         )
      .addItem('Random Crates (50)',            'rCrateFinish'        )
      .addItem('Enkephalin Box (12)',           'enkeBFinish'         )
      .addItem('Extraction Tickets (20)',       'extTicketFinish'     )
      .addSeparator()
      .addItem('The Rest',                      'theRestFinish'       ) )
    .addSeparator()
    .addSubMenu(ui.createMenu('Uptying Menu')
      .addSubMenu(ui.createMenu('00 Uptie')
        .addItem('00  UT2 (10)',                'ut2_00'              )
        .addItem('00  UT3 (40)',                'ut3_00'              )
        .addItem('00  UT4 (100) + (30 Shard)',  'ut4_00'              )
        .addItem('00  UT3 from UT1 (50)',       'ut3_00Ft1'           ) )
      .addSeparator()
      .addItem('000 UT2 (20)',                  'ut2_000'             )
      .addItem('000 UT3 (80)',                  'ut3_000'             )
      .addItem('000 UT4 (150) + (50 Shard)',    'ut4_000'             )
      .addItem('000 UT3 from UT1 (100)',        'ut3_000Ft1'          )
      .addSeparator()
      .addItem('UT4 Module',                    'ut4_module'          ) )
    .addSubMenu(ui.createMenu('Thread Spinning Menu')
      .addSubMenu(ui.createMenu('ZAYIN')
        .addItem('TS2 (20)',                    'zayin2'              )
        .addItem('TS3 (60)',                    'zayin3'              )
        .addItem('TS4 (110) + (80 Shard)',      'zayin4'              )
        .addItem('TS3 from TS1 (80)',           'zayin3_1'            ) )
      // .addSeparator()
      .addSubMenu(ui.createMenu('TETH')
        .addItem('TS2 (25)',                    'teth2'               )
        .addItem('TS3 (70)',                    'teth3'               )
        .addItem('TS4 (130) + (90 Shard)',      'teth4'               )
        .addItem('TS3 from TS1 (95)',           'teth3_1'             ) )
      // .addSeparator()
      .addSubMenu(ui.createMenu('HE')
        .addItem('TS2 (30)',                    'he2'                 )
        .addItem('TS3 (80)',                    'he3'                 )
        .addItem('TS4 (150) + (100 Shard)',     'he4'                 )
        .addItem('TS3 from TS1 (110)',          'he3_1'               ) )
      // .addSeparator()
      .addSubMenu(ui.createMenu('WAW')
        .addItem('TS2 (35)',                    'waw2'                )
        .addItem('TS3 (90)',                    'waw3'                )
        .addItem('TS4 (170) + (150 Shard)',     'waw4'                )
        .addItem('TS3 from TS1 (125)',          'waw3_1'              ) ) )
    .addSeparator()
    .addItem   ('New Banner Announced',         'newIDAnnounced'        )
    .addItem   ('New Season Start',             'newSeason'             )
    // .addItem('Test Function',                   'intervalloStart'       )
    .addToUi();
}
function cmenuDayUpdate  () {  updateWeekDay();  updateCurrentDate();         }
function newIDAnnounced  () {
  acq2StarRangeCell.setNumberFormat ('???/'  + Number(clDRV ('K2')));
  acq3StarRangeCell.setNumberFormat ('???/'  + Number(clDRV ('K4')));
  acqIDRangeCell.setNumberFormat    ('???/'  + Number(clDRV ('K6')));
  acqEGORangeCell.setNumberFormat   ('???/'  + Number(clDRV ('K8')));
}
function intervalloStart () {  intervalloShop1.setValue(0); intervalloShop2.setValue('FALSE');  }
function onRW            () {  if (rentalMD.getValue() === 'TRUE') {rentalWeek.setValue(0);} else {rentalWeek.setValue(1);}}
//#endregion