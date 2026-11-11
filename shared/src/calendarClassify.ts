/**
 * Guessing an event's type from its text - for events brought in from Google
 * Calendar, which has no notion of our types (its .ics export doesn't even
 * carry the event colour). Titles in this office are a mix of English,
 * Kannada script and Kannada typed in English, so each rule lists all three.
 *
 * Rules run in order; the first that matches wins. Order matters: a wedding
 * in a temple hall is a family function, a shop's Lakshmi pooja is a store
 * opening, a "house opening" is a Gruhapravesha, not a store.
 */
import type { CalendarEventType } from './calendar.js';

const RULES: [CalendarEventType, RegExp][] = [
  ['EVENT_FUNERAL', /funeral|condolence|shradd?hanjali|kailasa|samaradhane|shivaganaaradhane|nidhana|vaikunta|ವೈಕುಂಠ|ಪುಣ್ಯಸ್ಮರಣೆ|ಕೈಲಾಸ|ಸಮಾರಾಧನೆ|ಶ್ರದ್ಧಾಂಜಲಿ|ನಿಧನ|ಅಂತ್ಯಕ್ರಿಯೆ|ಶಿವಗಣಾರಾಧನೆ/i],
  ['PARTY_PROTEST', /protest|prat(h)?ibhatane|dharna|ಪ್ರತಿಭಟನೆ|ಧರಣಿ/i],
  ['UNAVAILABLE', /\bon leave\b|\bleave\b|out of station|assembly session|parliament session|ಅಧಿವೇಶನ|ರಜೆ/i],
  ['PARTY', /congress|ಕಾಂಗ್ರೆಸ್|\baicc\b|\bkpcc\b|\bclp\b|\bbjp\b|\bjds\b|party|ಪಕ್ಷ|election|chunavane|ಚುನಾವಣೆ|prachara|ಪ್ರಚಾರ|ಸಂಘಟನ ಸೃಜನ್|sanghatan srujan|ಒಕ್ಕೂಟದ|ಪದಗ್ರಹಣ|\bmillat\b/i],
  ['EVENT_T2', /wedding|weds|\bwed\b|reception|marr?(i|a)ge|marrige|nik(h)?a(h|m)?\b|walima|valima|engagement|nis(h)?chith?art(h)?a|naming|namakarana|thottilu|tottilu|seemant(h)?a|simant(h)?a|gruha ?pravesha|griha ?pravesh|h[op]use\s*(opening|warming)|birth ?day|ಮದುವೆ|ವಿವಾಹ|ಆರತಕ್ಷತೆ|ನಿಖಾ|ವಲಿಮಾ|ವಲೀಮಾ|ನಿಶ್ಚಿತಾರ್ಥ|ನಾಮಕರಣ|ತೊಟ್ಟ|ಸೀಮಂತ|ಗೃಹ ?ಪ್ರವೇಶ|ಜನ್ಮದಿನದ ಕಾರ್ಯಕ್ರಮ|ಹುಟ್ಟುಹಬ್ಬ|ವೆಡ್ಸ್/i],
  ['SITE_VISIT', /ಕಾಮಗಾರಿ|works? (inspection|visit)|site (visit|vist|inspection)|inspection|gudli pooj|ಗುದ್ದಲಿ|\bcc road\b|road route|street lights|stadium nee|re-engineering|\bsurvey\b|jalasiri|market visit|clock tower visit|\bwch visit\b/i],
  // A school / bus / association opening is a public function, not a shop opening.
  ['EVENT_T1', /(school|college|rooms?|\bbus\b|ಬಸ್|ಶಾಲಾ|ಕಾಲೇಜು|samit(h)?i|ಸಮಿತಿ|sangha|ಸಂಘ|association|union|library).*(opening|inaug|udghat|ಉದ್ಘಾಟನ)|(opening|inaug|udghat|ಉದ್ಘಾಟನ).*(school|college|samit(h)?i|association|union)/i],
  ['EVENT_T2B', /grand opening|\bopening\b|launch|show ?room|\bstore\b|\bshop\b|ಅಂಗಡಿ|traders|ಟ್ರೇಡರ್ಸ್|jewell?ers|jewellars|ಜ್ಯೂಯಲರ್ಸ್|\bcafe\b|hotel|interiors|construction|builders|developers|enterprises|ಎಂಟರ್‌? ?ಪ್ರೈಸಸ್|petrol bunk|malabar|malbar|\bgold\b|diamonds|pvt ltd|shubharambha|shbharambha|detailing|plaza|studio|biryani|\bpaan\b|sandwich|furniture|steels?|ಗ್ರಾನೈಟ್|ಪ್ಲಾಂಟ್|ಮೆಡಿಕಲ್‌? ಶಾಪ್|ಶಾಪ್|ಹೋಟೆಲ್|convention hall|ಕನ್ವೆನ್ಷನ್|dealers meet|\bapp\b|ಕಛೇರಿ ಉದ್ಘಾಟನೆ|ಬ್ಯಾಂಕ್‌? ?ನ .*ಉದ್ಘಾಟನೆ|contractor|\bstamps?\b|e-stamp|ಈ-ಸ್ಟ್ಯಾಂಪ್/i],
  ['EVENT_T3', /temple|devasthana|deva?s(t|th|at)ana|devestana|ದೇವಸ್ಥಾನ|ದೇವಾಲಯ|\bmat(h|ha)\b|\bmutt\b|ಮಠ|swam(i|y)|ಸ್ವಾಮಿ|jat(h)?r(a|e|i)|ಜಾತ್ರೆ|pooj(a|e)|\bpuja\b|ಪೂಜೆ|ಪೂಜಾ|ganesh|ganapathi|ಗಣೇಶ|ಗಣಪತಿ|visarj|ವಿಸರ್ಜನೆ|kumbh|ಕುಂಭಾಭಿಷೇಕ|ಹೋಮ|darga|dargah|\burus\b|masjid|ಮಸ್ಜಿದ್|madrasa|ಮದ್ರೆಸಾ|church|anna ?santh?arpane|ಅನ್ನಸಂತರ್ಪಣೆ|anasantarpanae|rat(h)?ay(a|o)t(h)?re|ratho(t)?sava|dasara|ದಸರಾ|navaratri|ನವರಾತ್ರಿ|ಪುಣ್ಯಾರಾಧನೆ|punyaradhane|ಪುಣ್ಯ ?ಸ್ಮರಣೋತ್ಸವ|guru ?poornima|ಪ್ರವಚನ|prat(h)?ist(h)?apane|ಪ್ರತಿಷ್ಠಾಪನೆ|moharam|muharram|dharma samavesha|ರುದ್ರಾಭಿಷೇಕ|abhishek|sai ?baba|ಸಾಯಿಬಾಬಾ|ಮಹಾಂಕಾಳಿ|maramma|ಮಾರಮ್ಮ|mariyamma|mariamma|durg(a|amma|ambika)|dugamma|duggamma|ಹುತ್ತದ|guggala|kalasarohana|varshikothsava|ಮಹೋತ್ಸವ|mahotsava|mahothsava|janmadinothsava|ಗುರು ವಂದನೆ|guru vandane/i],
  ['BOOTH_NADIGE', /booth|ಬೂತ್|nadige|ನಡಿಗೆ|gramina|ಗ್ರಾಮೀಣ|booth wise/i],
  ['JANA_SAMPARKA', /jana ?samparka|ಜನಸಂಪರ್ಕ|ಜನ ಸಂಪರ್ಕ|jana ?spandana|ಜನಸ್ಪಂದನ|jana ?kacheri|prajaseva|public meeting|ward bheti|ward meeting|house visit/i],
  ['MEETING_GOVERNANCE', /review|pragat(h)?i parisheelana|ಪ್ರಗತಿ ಪರಿಶೀಲನೆ|corporation|ಪಾಲಿಕೆ|mahanagarapalike|\bzp\b|zilla panchayat|ಜಿಲ್ಲಾ ಪಂಚಾಯ|dhuda|d\.h\.u\.d\.a|ಪ್ರಾಧಿಕಾರ|department|officials|tah?s(h)?ildar|commissioner|comissioner|\bdc\b|nigama|ನಿಗಮ|committee meeting|ಸಮಿತಿ ಸಭೆ|gurantee|guarantee|\brws\b|\bkdp\b|chief minister|ಮುಖ್ಯಮಂತ್ರಿ|town planning|\bsir\b|s i r|\bbea\b|\bcopo\b|public undertakings|ಸಾರ್ವಜನಿಕ ಉದ್ಯಮಗಳ/i],
  // Chief-guest words win over the generic "meeting" rule ("felicitation meeting", "AGM and merit award").
  ['EVENT_T1', /felicitation|facilitation|falicitation|ಸನ್ಮಾನ|sanmana|sanamana|puraskar|purskara|ಪುರಸ್ಕಾರ|inaug|innaug|ಉದ್ಘಾಟನ|udghat|chief guest|ದಿನಾಚರಣೆ|merit award|annual general/i],
  ['MEETING_OFFICIAL', /meeting|ಸಭೆ|sabhe|discussion|discuss|manpower|project|architect|organi[sz]e drive|topics|\bw\d+\b|incharge|bengaluru|delhi/i],
  // Anything else that reads as a public function -> Chief-guest type event.
  ['EVENT_T1', /inaug|innaug|ಉದ್ಘಾಟನ|felicitation|facilitation|falicitation|ಸನ್ಮಾನ|sanmana|puraskar|ಪುರಸ್ಕಾರ|chief guest|guest|programme|program|karyakrama|ಕಾರ್ಯಕ್ರಮ|celebration|jayant(h)?i|ಜಯಂತಿ|tournament|championship|competition|ಸ್ಪರ್ಧೆ|ಕ್ರೀಡಾಕೂಟ|ceremony|samarambha|ಸಮಾರಂಭ|samavesha|ಸಮಾವೇಶ|ಮೆರವಣಿಗೆ|meravanige|utsav|ಉತ್ಸವ|function|sammelana|ಸಮ್ಮೇಳನ|conference|annual day|graduation|ರಾಜ್ಯೋತ್ಸವ|rajyot(h)?sava|day celebration|shibir|ಶಿಬಿರ|ವಿತರಣೆ|distribution|otsava|ೋತ್ಸವ|vaibhava|ವೈಭವ|saurabha|kalaga|ಕಾಳಗ|varshika|ವಾರ್ಷಿಕ|anavarana|janma ?dina|januma|event|trust|planting|ayugrama|ಜಯಂತ|\bday\b|mela|ಮೇಳ|dandiya|ದಾಂಡಿಯಾ|nataka|drama|award|prashasti|ಪ್ರಶಸ್ತಿ|school|college|university|visit/i],
];

/** Best-guess type for an event's text, or null when nothing in it is recognisable. */
export function classifyCalendarEvent(text: { title?: string | null; description?: string | null; venue?: string | null }): CalendarEventType | null {
  const title = (text.title ?? '').trim();
  for (const [type, re] of RULES) if (re.test(title)) return type;
  // Nothing in the title - try the notes and the place (temple / hall names often live there).
  const rest = `${text.description ?? ''} ${text.venue ?? ''}`.trim();
  if (rest) for (const [type, re] of RULES) if (type !== 'EVENT_T1' && re.test(rest)) return type;
  return null;
}

const MEET_BLOCK = /-::~[:~]*::-[\s\S]*?-::~[:~]*::-/g;
const BOILERPLATE = [
  /^Join with Google Meet:.*$/gim,
  /^Join by phone.*$/gim,
  /^Learn more about Meet at:.*$/gim,
  /^Please do not edit this section\.?$/gim,
  /^This is an event reminder\.?$/gim,
  /^Invitation from Google Calendar:.*$/gim,
  /^You are receiving this (email|courtesy).*$/gim,
  /^Forwarding this invitation could allow.*$/gim,
];

/** Strips Google Calendar's own boilerplate (Meet link block, reminders) from an imported description. */
export function cleanImportedDescription(text: string | null | undefined): string {
  let s = (text ?? '').replace(/\r\n/g, '\n');
  s = s.replace(MEET_BLOCK, '');
  // A lone separator line can remain when the block was cut short.
  s = s.replace(/^-::~[:~]*::-$/gm, '');
  for (const re of BOILERPLATE) s = s.replace(re, '');
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** First Indian mobile number (10 digits, starting 6-9) in a piece of text, formatted "98450 12345". */
export function findMobileNumber(text: string | null | undefined): string | null {
  const m = /(?:\+?91[\s-]?)?(?<![\d])([6-9]\d{4})[\s-]?(\d{5})(?![\d])/.exec(text ?? '');
  return m ? `${m[1]} ${m[2]}` : null;
}
