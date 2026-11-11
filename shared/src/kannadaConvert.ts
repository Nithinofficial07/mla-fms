/**
 * English -> Kannada for event titles and venues (posters, public schedule).
 * Runs entirely in-app, nothing is sent anywhere. Three layers:
 *  1. the office's common title shapes ("Wedding(A weds B)", "X Inauguration", "Inauguration of X");
 *  2. a dictionary of the words those titles and venues use;
 *  3. everything else (names, places) written in Kannada letters, acronyms spelt out ("VMJ" -> "ವಿ ಎಂ ಜೆ").
 * Spelling of names is a best guess (English spelling doesn't say long/short
 * vowels or dental/retroflex) - the poster lets people correct it once and
 * saves the corrected wording on the event.
 */

const LATIN = /[A-Za-z]/;
const KANNADA = /[ಀ-೿]/;

/** True when the text still has English letters worth converting. */
export const needsKannada = (s: string | null | undefined) => !!s && LATIN.test(s);

/* --------------------------------- dictionary --------------------------------- */
// Longest phrases first (sorted below). Keys are lower case; an empty value drops the word.
const WORDS: Record<string, string> = {
  // family functions
  'wedding reception': 'ವಿವಾಹ ಆರತಕ್ಷತೆ', wedding: 'ವಿವಾಹ', marriage: 'ವಿವಾಹ', marrige: 'ವಿವಾಹ', reception: 'ಆರತಕ್ಷತೆ',
  receptions: 'ಆರತಕ್ಷತೆ', engagement: 'ನಿಶ್ಚಿತಾರ್ಥ', nishchithartha: 'ನಿಶ್ಚಿತಾರ್ಥ', nikah: 'ನಿಖಾ', nikha: 'ನಿಖಾ', nikaah: 'ನಿಖಾ',
  valima: 'ವಲಿಮಾ', walima: 'ವಲಿಮಾ', 'naming ceremony': 'ನಾಮಕರಣ', naming: 'ನಾಮಕರಣ', namakarana: 'ನಾಮಕರಣ',
  'thottilu shastra': 'ತೊಟ್ಟಿಲು ಶಾಸ್ತ್ರ', thottilu: 'ತೊಟ್ಟಿಲು', 'cradle ceremony': 'ತೊಟ್ಟಿಲು ಶಾಸ್ತ್ರ',
  seemantha: 'ಸೀಮಂತ', simantha: 'ಸೀಮಂತ', 'house warming ceremony': 'ಗೃಹಪ್ರವೇಶ', 'house warming': 'ಗೃಹಪ್ರವೇಶ',
  housewarming: 'ಗೃಹಪ್ರವೇಶ', 'house opening ceremony': 'ಗೃಹಪ್ರವೇಶ', 'house opening': 'ಗೃಹಪ್ರವೇಶ', 'house openings': 'ಗೃಹಪ್ರವೇಶ',
  gruhapravesha: 'ಗೃಹಪ್ರವೇಶ', 'birthday celebration': 'ಹುಟ್ಟುಹಬ್ಬ', 'birth day celebration': 'ಹುಟ್ಟುಹಬ್ಬ', birthday: 'ಹುಟ್ಟುಹಬ್ಬ',
  'birth day': 'ಹುಟ್ಟುಹಬ್ಬ', funeral: 'ಅಂತ್ಯಕ್ರಿಯೆ', condolence: 'ಶ್ರದ್ಧಾಂಜಲಿ', 'kailasa samaradhane': 'ಕೈಲಾಸ ಸಮಾರಾಧನೆ',
  'kailasa shivaganaaradhane': 'ಕೈಲಾಸ ಶಿವಗಣಾರಾಧನೆ', 'kailasa shiva ganaaradhane': 'ಕೈಲಾಸ ಶಿವಗಣಾರಾಧನೆ', invitation: '',
  daughter: 'ಮಗಳ', "daughter's": 'ಮಗಳ', son: 'ಮಗನ', "son's": 'ಮಗನ', granddaughter: 'ಮೊಮ್ಮಗಳ', grandson: 'ಮೊಮ್ಮಗನ', late: 'ದಿವಂಗತ',
  // openings
  'grand opening': 'ಗ್ರಾಂಡ್ ಓಪನಿಂಗ್', 'grand store opening': 'ಗ್ರಾಂಡ್ ಓಪನಿಂಗ್', opening: 'ಉದ್ಘಾಟನೆ', inauguration: 'ಉದ್ಘಾಟನೆ',
  inaugration: 'ಉದ್ಘಾಟನೆ', innauguration: 'ಉದ್ಘಾಟನೆ', inaugural: 'ಉದ್ಘಾಟನಾ', innaugoral: 'ಉದ್ಘಾಟನಾ', 'inaugural ceremony': 'ಉದ್ಘಾಟನಾ ಸಮಾರಂಭ',
  'inauguration ceremony': 'ಉದ್ಘಾಟನಾ ಸಮಾರಂಭ', 'inauguration program': 'ಉದ್ಘಾಟನಾ ಕಾರ್ಯಕ್ರಮ', 'inauguration programme': 'ಉದ್ಘಾಟನಾ ಕಾರ್ಯಕ್ರಮ',
  launch: 'ಬಿಡುಗಡೆ', 'official launch': 'ಅಧಿಕೃತ ಬಿಡುಗಡೆ', showroom: 'ಶೋರೂಂ', 'show room': 'ಶೋರೂಂ', shop: 'ಅಂಗಡಿ', store: 'ಸ್ಟೋರ್',
  traders: 'ಟ್ರೇಡರ್ಸ್', jewellers: 'ಜ್ಯುವೆಲ್ಲರ್ಸ್', jewellars: 'ಜ್ಯುವೆಲ್ಲರ್ಸ್', enterprises: 'ಎಂಟರ್‌ಪ್ರೈಸಸ್', hotel: 'ಹೋಟೆಲ್',
  cafe: 'ಕೆಫೆ', 'petrol bunk': 'ಪೆಟ್ರೋಲ್ ಬಂಕ್', construction: 'ಕನ್‌ಸ್ಟ್ರಕ್ಷನ್', constructions: 'ಕನ್‌ಸ್ಟ್ರಕ್ಷನ್ಸ್', interiors: 'ಇಂಟೀರಿಯರ್ಸ್',
  builders: 'ಬಿಲ್ಡರ್ಸ್', developers: 'ಡೆವಲಪರ್ಸ್', 'pvt ltd': 'ಪ್ರೈ. ಲಿ.', studio: 'ಸ್ಟುಡಿಯೋ', academy: 'ಅಕಾಡೆಮಿ',
  // temple / religious
  temple: 'ದೇವಸ್ಥಾನ', devasthana: 'ದೇವಸ್ಥಾನ', pooja: 'ಪೂಜೆ', puja: 'ಪೂಜೆ', pooje: 'ಪೂಜೆ', 'lakshmi pooja': 'ಲಕ್ಷ್ಮೀ ಪೂಜೆ',
  'ayudha pooja': 'ಆಯುಧ ಪೂಜೆ', 'ayuda pooja': 'ಆಯುಧ ಪೂಜೆ', 'bhoomi pooja': 'ಭೂಮಿ ಪೂಜೆ', 'gudli pooje': 'ಗುದ್ದಲಿ ಪೂಜೆ',
  jathre: 'ಜಾತ್ರೆ', jatre: 'ಜಾತ್ರೆ', jathra: 'ಜಾತ್ರೆ', jatra: 'ಜಾತ್ರೆ', mahotsava: 'ಮಹೋತ್ಸವ', mahothsava: 'ಮಹೋತ್ಸವ', utsava: 'ಉತ್ಸವ',
  ganeshotsava: 'ಗಣೇಶೋತ್ಸವ', ganeshothsava: 'ಗಣೇಶೋತ್ಸವ', 'ganesh chaturthi': 'ಗಣೇಶ ಚತುರ್ಥಿ', 'ganesha visarjane': 'ಗಣೇಶ ವಿಸರ್ಜನೆ',
  festival: 'ಹಬ್ಬ', mutt: 'ಮಠ', math: 'ಮಠ', matha: 'ಮಠ', swamiji: 'ಸ್ವಾಮೀಜಿ', annasantarpane: 'ಅನ್ನಸಂತರ್ಪಣೆ',
  'anna santharpane': 'ಅನ್ನಸಂತರ್ಪಣೆ', dasara: 'ದಸರಾ', navaratri: 'ನವರಾತ್ರಿ', 'vijayadashami': 'ವಿಜಯದಶಮಿ', darga: 'ದರ್ಗಾ', dargah: 'ದರ್ಗಾ',
  urus: 'ಉರುಸ್', masjid: 'ಮಸೀದಿ', church: 'ಚರ್ಚ್', 'guru poornima': 'ಗುರು ಪೂರ್ಣಿಮಾ', kumbhabhisheka: 'ಕುಂಭಾಭಿಷೇಕ',
  // programmes
  programme: 'ಕಾರ್ಯಕ್ರಮ', program: 'ಕಾರ್ಯಕ್ರಮ', programs: 'ಕಾರ್ಯಕ್ರಮಗಳು', karyakrama: 'ಕಾರ್ಯಕ್ರಮ', function: 'ಸಮಾರಂಭ',
  ceremony: 'ಸಮಾರಂಭ', samarambha: 'ಸಮಾರಂಭ', celebration: 'ಆಚರಣೆ', celebrations: 'ಆಚರಣೆ', meeting: 'ಸಭೆ', meet: 'ಸಭೆ',
  'public meeting': 'ಸಾರ್ವಜನಿಕ ಸಭೆ', felicitation: 'ಸನ್ಮಾನ', facilitation: 'ಸನ್ಮಾನ', falicitation: 'ಸನ್ಮಾನ', sanmana: 'ಸನ್ಮಾನ',
  sanamana: 'ಸನ್ಮಾನ', award: 'ಪ್ರಶಸ್ತಿ', awards: 'ಪ್ರಶಸ್ತಿ', 'prathibha puraskara': 'ಪ್ರತಿಭಾ ಪುರಸ್ಕಾರ', 'pratibha puraskara': 'ಪ್ರತಿಭಾ ಪುರಸ್ಕಾರ',
  'annual day': 'ವಾರ್ಷಿಕೋತ್ಸವ', 'annual day celebration': 'ವಾರ್ಷಿಕೋತ್ಸವ', 'annual general meeting': 'ವಾರ್ಷಿಕ ಮಹಾಸಭೆ',
  'graduation day': 'ಪದವಿ ಪ್ರದಾನ ಸಮಾರಂಭ', 'graduation ceremony': 'ಪದವಿ ಪ್ರದಾನ ಸಮಾರಂಭ', graduation: 'ಪದವಿ ಪ್ರದಾನ',
  'sports meet': 'ಕ್ರೀಡಾಕೂಟ', tournament: 'ಪಂದ್ಯಾವಳಿ', 'cricket tournament': 'ಕ್ರಿಕೆಟ್ ಪಂದ್ಯಾವಳಿ', competition: 'ಸ್ಪರ್ಧೆ',
  championship: 'ಚಾಂಪಿಯನ್‌ಶಿಪ್', conference: 'ಸಮ್ಮೇಳನ', sammelana: 'ಸಮ್ಮೇಳನ', procession: 'ಮೆರವಣಿಗೆ', rally: 'ಜಾಥಾ',
  protest: 'ಪ್ರತಿಭಟನೆ', jayanthi: 'ಜಯಂತಿ', jayanti: 'ಜಯಂತಿ', 'jana samparka': 'ಜನಸಂಪರ್ಕ', janasamparka: 'ಜನಸಂಪರ್ಕ',
  'jana samparka sabha': 'ಜನಸಂಪರ್ಕ ಸಭೆ', 'jana spandana': 'ಜನಸ್ಪಂದನ', janaspandana: 'ಜನಸ್ಪಂದನ', 'jana kacheri': 'ಜನತಾ ಕಚೇರಿ',
  visit: 'ಭೇಟಿ', 'site visit': 'ಸ್ಥಳ ಪರಿಶೀಲನೆ', inspection: 'ಪರಿಶೀಲನೆ', survey: 'ಸಮೀಕ್ಷೆ', 'health camp': 'ಆರೋಗ್ಯ ಶಿಬಿರ',
  camp: 'ಶಿಬಿರ', distribution: 'ವಿತರಣೆ', 'book distribution': 'ಪುಸ್ತಕ ವಿತರಣೆ', 'books distribution': 'ಪುಸ್ತಕ ವಿತರಣೆ',
  'kannada rajyotsava': 'ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ', 'kannada rajyothsava': 'ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ', 'independence day': 'ಸ್ವಾತಂತ್ರ್ಯ ದಿನಾಚರಣೆ',
  'republic day': 'ಗಣರಾಜ್ಯೋತ್ಸವ', 'yoga day': 'ಯೋಗ ದಿನ', 'international day of yoga': 'ಅಂತರರಾಷ್ಟ್ರೀಯ ಯೋಗ ದಿನ',
  'doctors day': 'ವೈದ್ಯರ ದಿನಾಚರಣೆ', "teachers day": 'ಶಿಕ್ಷಕರ ದಿನಾಚರಣೆ', drama: 'ನಾಟಕ', nataka: 'ನಾಟಕ', 'drama festival': 'ನಾಟಕೋತ್ಸವ',
  'state level': 'ರಾಜ್ಯ ಮಟ್ಟದ', 'district level': 'ಜಿಲ್ಲಾ ಮಟ್ಟದ', 'all india': 'ಅಖಿಲ ಭಾರತ', international: 'ಅಂತರರಾಷ್ಟ್ರೀಯ',
  'chief guest': 'ಮುಖ್ಯ ಅತಿಥಿ', guest: 'ಅತಿಥಿ', new: 'ನೂತನ', special: 'ವಿಶೇಷ', 'special guest': 'ವಿಶೇಷ ಅತಿಥಿ',
  // people / offices
  mr: 'ಶ್ರೀ', 'mr.': 'ಶ್ರೀ', mrs: 'ಶ್ರೀಮತಿ', 'mrs.': 'ಶ್ರೀಮತಿ', smt: 'ಶ್ರೀಮತಿ', 'smt.': 'ಶ್ರೀಮತಿ', shri: 'ಶ್ರೀ', sri: 'ಶ್ರೀ',
  shree: 'ಶ್ರೀ', dr: 'ಡಾ.', 'dr.': 'ಡಾ.', mla: 'ಶಾಸಕರು', mp: 'ಸಂಸದರು', minister: 'ಸಚಿವರು', 'chief minister': 'ಮುಖ್ಯಮಂತ್ರಿಗಳು',
  dc: 'ಜಿಲ್ಲಾಧಿಕಾರಿ', zp: 'ಜಿಲ್ಲಾ ಪಂಚಾಯತ್', 'zilla panchayat': 'ಜಿಲ್ಲಾ ಪಂಚಾಯತ್', corporation: 'ಮಹಾನಗರ ಪಾಲಿಕೆ',
  'municipal corporation': 'ಮಹಾನಗರ ಪಾಲಿಕೆ', tahsildar: 'ತಹಶೀಲ್ದಾರ್', commissioner: 'ಆಯುಕ್ತರು', officials: 'ಅಧಿಕಾರಿಗಳು',
  department: 'ಇಲಾಖೆ', departments: 'ಇಲಾಖೆಗಳು', congress: 'ಕಾಂಗ್ರೆಸ್', party: 'ಪಕ್ಷ', workers: 'ಕಾರ್ಯಕರ್ತರು', committee: 'ಸಮಿತಿ',
  comitee: 'ಸಮಿತಿ', association: 'ಸಂಘ', sangha: 'ಸಂಘ', samaja: 'ಸಮಾಜ', samithi: 'ಸಮಿತಿ', trust: 'ಟ್ರಸ್ಟ್', club: 'ಕ್ಲಬ್',
  students: 'ವಿದ್ಯಾರ್ಥಿಗಳು', student: 'ವಿದ್ಯಾರ್ಥಿ', winners: 'ವಿಜೇತರು', winner: 'ವಿಜೇತ', youth: 'ಯುವಜನ', women: 'ಮಹಿಳೆಯರ',
  // places
  school: 'ಶಾಲೆ', college: 'ಕಾಲೇಜು', university: 'ವಿಶ್ವವಿದ್ಯಾಲಯ', hospital: 'ಆಸ್ಪತ್ರೆ', office: 'ಕಛೇರಿ', library: 'ಗ್ರಂಥಾಲಯ',
  'community hall': 'ಸಮುದಾಯ ಭವನ', 'samudaya bhavana': 'ಸಮುದಾಯ ಭವನ', 'convention hall': 'ಕನ್ವೆನ್ಷನ್ ಹಾಲ್',
  'kalyana mantapa': 'ಕಲ್ಯಾಣ ಮಂಟಪ', 'kalyana mantap': 'ಕಲ್ಯಾಣ ಮಂಟಪ', mantapa: 'ಮಂಟಪ', hall: 'ಹಾಲ್', bhavana: 'ಭವನ',
  stadium: 'ಕ್ರೀಡಾಂಗಣ', ground: 'ಮೈದಾನ', grounds: 'ಮೈದಾನ', 'main road': 'ಮುಖ್ಯ ರಸ್ತೆ', road: 'ರಸ್ತೆ', rd: 'ರಸ್ತೆ',
  cross: 'ಕ್ರಾಸ್', circle: 'ಸರ್ಕಲ್', layout: 'ಬಡಾವಣೆ', badavane: 'ಬಡಾವಣೆ', extension: 'ಬಡಾವಣೆ', nagar: 'ನಗರ', nagara: 'ನಗರ',
  colony: 'ಕಾಲೋನಿ', village: 'ಗ್ರಾಮ', taluk: 'ತಾಲ್ಲೂಕು', taluka: 'ತಾಲ್ಲೂಕು', district: 'ಜಿಲ್ಲೆ', ward: 'ವಾರ್ಡ್', block: 'ಬ್ಲಾಕ್',
  near: 'ಹತ್ತಿರ', opposite: 'ಎದುರು', opp: 'ಎದುರು', behind: 'ಹಿಂಭಾಗ', davangere: 'ದಾವಣಗೆರೆ', davanagere: 'ದಾವಣಗೆರೆ',
  dvg: 'ದಾವಣಗೆರೆ', harihar: 'ಹರಿಹರ', harihara: 'ಹರಿಹರ', channagiri: 'ಚನ್ನಗಿರಿ', chitradurga: 'ಚಿತ್ರದುರ್ಗ',
  bengaluru: 'ಬೆಂಗಳೂರು', bangalore: 'ಬೆಂಗಳೂರು', delhi: 'ದೆಹಲಿ', palace: 'ಪ್ಯಾಲೇಸ್', 'bus stand': 'ಬಸ್ ನಿಲ್ದಾಣ', bus: 'ಬಸ್',
  park: 'ಉದ್ಯಾನವನ', market: 'ಮಾರುಕಟ್ಟೆ', residence: 'ನಿವಾಸ', house: 'ಮನೆ', home: 'ಮನೆ', 'home office': 'ಗೃಹ ಕಚೇರಿ',
  // common local names and words (English spelling hides the long vowels)
  swami: 'ಸ್ವಾಮಿ', swamy: 'ಸ್ವಾಮಿ', anjaneya: 'ಆಂಜನೇಯ', anjaneyaswamy: 'ಆಂಜನೇಯಸ್ವಾಮಿ', vinayaka: 'ವಿನಾಯಕ', ganesha: 'ಗಣೇಶ',
  ganesh: 'ಗಣೇಶ್', kumar: 'ಕುಮಾರ್', raju: 'ರಾಜು', raj: 'ರಾಜ್', manjunath: 'ಮಂಜುನಾಥ್', manjunatha: 'ಮಂಜುನಾಥ', basavaraj: 'ಬಸವರಾಜ್',
  mallikarjun: 'ಮಲ್ಲಿಕಾರ್ಜುನ್', mallikarjuna: 'ಮಲ್ಲಿಕಾರ್ಜುನ', shamanur: 'ಶಾಮನೂರು', samarth: 'ಸಮರ್ಥ್', shivashankarappa: 'ಶಿವಶಂಕರಪ್ಪ',
  bapuji: 'ಬಾಪೂಜಿ', vasavi: 'ವಾಸವಿ', karnataka: 'ಕರ್ನಾಟಕ', rajya: 'ರಾಜ್ಯ', durgambika: 'ದುರ್ಗಾಂಬಿಕಾ', durga: 'ದುರ್ಗಾ',
  maramma: 'ಮಾರಮ್ಮ', chowdeshwari: 'ಚೌಡೇಶ್ವರಿ', basaveshwara: 'ಬಸವೇಶ್ವರ', veerabhadreshwara: 'ವೀರಭದ್ರೇಶ್ವರ', saibaba: 'ಸಾಯಿಬಾಬಾ',
  sai: 'ಸಾಯಿ', baba: 'ಬಾಬಾ', md: 'ಮಹಮ್ಮದ್', mohd: 'ಮಹಮ್ಮದ್', mohammed: 'ಮಹಮ್ಮದ್', mohammad: 'ಮಹಮ್ಮದ್', muhammad: 'ಮಹಮ್ಮದ್',
  khan: 'ಖಾನ್', basha: 'ಬಾಷಾ', taj: 'ತಾಜ್', banu: 'ಬಾನು', begum: 'ಬೇಗಂ', syed: 'ಸೈಯದ್', archana: 'ಅರ್ಚನಾ', anusha: 'ಅನುಷಾ',
  sagar: 'ಸಾಗರ್', akash: 'ಆಕಾಶ್', prakash: 'ಪ್ರಕಾಶ್', ramesh: 'ರಮೇಶ್', suresh: 'ಸುರೇಶ್', mahesh: 'ಮಹೇಶ್', nagaraj: 'ನಾಗರಾಜ್',
  shivakumar: 'ಶಿವಕುಮಾರ್', vidya: 'ವಿದ್ಯಾ', kavya: 'ಕಾವ್ಯ', nayana: 'ನಯನಾ', narayana: 'ನಾರಾಯಣ', rama: 'ರಾಮ', krishna: 'ಕೃಷ್ಣ',
  lakshmi: 'ಲಕ್ಷ್ಮೀ', mahalakshmi: 'ಮಹಾಲಕ್ಷ್ಮೀ', amrutha: 'ಅಮೃತ', mustafa: 'ಮುಸ್ತಫಾ', imam: 'ಇಮಾಮ್', basapura: 'ಬಸಾಪುರ',
  nittuvalli: 'ನಿಟ್ಟುವಳ್ಳಿ', anekonda: 'ಆನೆಕೊಂಡ', shamanuru: 'ಶಾಮನೂರು', vidyanagar: 'ವಿದ್ಯಾನಗರ', vinobanagar: 'ವಿನೋಬನಗರ',
  dandiya: 'ದಾಂಡಿಯಾ', mahotsav: 'ಮಹೋತ್ಸವ', utsav: 'ಉತ್ಸವ', karate: 'ಕರಾಟೆ', cricket: 'ಕ್ರಿಕೆಟ್', chess: 'ಚೆಸ್', yoga: 'ಯೋಗ',
  bank: 'ಬ್ಯಾಂಕ್', gold: 'ಗೋಲ್ಡ್', diamonds: 'ಡೈಮಂಡ್ಸ್', public: 'ಸಾರ್ವಜನಿಕ', works: 'ಕಾಮಗಾರಿ', discuss: 'ಚರ್ಚೆ',
  discussion: 'ಚರ್ಚೆ', about: 'ಕುರಿತು', building: 'ಕಟ್ಟಡ', participation: 'ಭಾಗವಹಿಸುವಿಕೆ', as: '', team: 'ತಂಡ', city: 'ನಗರ',
  'sports meets': 'ಕ್ರೀಡಾಕೂಟ', sports: 'ಕ್ರೀಡಾ', colleges: 'ಕಾಲೇಜುಗಳ', schools: 'ಶಾಲೆಗಳ', smart: 'ಸ್ಮಾರ್ಟ್', 'smart city': 'ಸ್ಮಾರ್ಟ್ ಸಿಟಿ', inter: 'ಅಂತರ', 'inter district': 'ಅಂತರ ಜಿಲ್ಲಾ', am: 'AM', pm: 'PM',
  // little words
  and: 'ಮತ್ತು', '&': 'ಮತ್ತು', with: 'ಜೊತೆ', for: '', of: '', the: '', at: '', in: '', to: '', a: '', on: '',
  day: 'ದಿನ', year: 'ವರ್ಷದ', years: 'ವರ್ಷಗಳ', anniversary: 'ವಾರ್ಷಿಕೋತ್ಸವ',
};
const PHRASES = Object.entries(WORDS).sort((a, b) => b[0].split(' ').length - a[0].split(' ').length || b[0].length - a[0].length);

/* ----------------------------- letter by letter ------------------------------ */
const LETTER: Record<string, string> = {
  A: 'ಎ', B: 'ಬಿ', C: 'ಸಿ', D: 'ಡಿ', E: 'ಇ', F: 'ಎಫ್', G: 'ಜಿ', H: 'ಹೆಚ್', I: 'ಐ', J: 'ಜೆ', K: 'ಕೆ', L: 'ಎಲ್', M: 'ಎಂ',
  N: 'ಎನ್', O: 'ಒ', P: 'ಪಿ', Q: 'ಕ್ಯೂ', R: 'ಆರ್', S: 'ಎಸ್', T: 'ಟಿ', U: 'ಯು', V: 'ವಿ', W: 'ಡಬ್ಲ್ಯೂ', X: 'ಎಕ್ಸ್', Y: 'ವೈ', Z: 'ಜೆಡ್',
};

const CONS: [string, string][] = [
  ['ksh', 'ಕ್ಷ'], ['chh', 'ಛ'], ['sh', 'ಶ'], ['ch', 'ಚ'], ['th', 'ತ'], ['dh', 'ಧ'], ['bh', 'ಭ'], ['gh', 'ಘ'], ['kh', 'ಖ'], ['ph', 'ಫ'],
  ['jh', 'ಝ'], ['k', 'ಕ'], ['g', 'ಗ'], ['j', 'ಜ'], ['t', 'ಟ'], ['d', 'ದ'], ['n', 'ನ'], ['p', 'ಪ'], ['b', 'ಬ'], ['m', 'ಮ'],
  ['y', 'ಯ'], ['r', 'ರ'], ['l', 'ಲ'], ['v', 'ವ'], ['w', 'ವ'], ['s', 'ಸ'], ['h', 'ಹ'], ['f', 'ಫ'], ['z', 'ಜ'], ['q', 'ಕ'], ['c', 'ಕ'], ['x', 'ಕ್ಸ'],
];
// [latin, independent vowel, vowel sign]
const VOWELS: [string, string, string][] = [
  ['aa', 'ಆ', 'ಾ'], ['ai', 'ಐ', 'ೈ'], ['au', 'ಔ', 'ೌ'], ['ou', 'ಔ', 'ೌ'], ['ee', 'ಈ', 'ೀ'], ['ii', 'ಈ', 'ೀ'], ['oo', 'ಊ', 'ೂ'],
  ['uu', 'ಊ', 'ೂ'], ['a', 'ಅ', ''], ['i', 'ಇ', 'ಿ'], ['u', 'ಉ', 'ು'], ['e', 'ಎ', 'ೇ'], ['o', 'ಒ', 'ೋ'],
];
const VIRAMA = '್';
const NO_ANUSVARA = new Set(['ಯ', 'ರ', 'ಲ', 'ವ', 'ಹ', 'ನ', 'ಮ']);

/** One English word (lower case, letters only) in Kannada letters. */
function transliterateWord(word: string): string {
  let out = '';
  let pending: string | null = null; // a consonant waiting for its vowel
  let i = 0;
  const n = word.length;
  while (i < n) {
    const rest = word.slice(i);
    const v = VOWELS.find(([l]) => rest.startsWith(l));
    if (v) {
      const sign = v[0] === 'e' && i + 1 === n ? 'ೆ' : v[2];
      out += pending ? pending + sign : v[1];
      pending = null;
      i += v[0].length;
      continue;
    }
    // final "y" after a consonant reads as "i" (Tanky, Ramy)
    if (rest === 'y' && pending) { out += `${pending}ಿ`; pending = null; i += 1; continue; }
    const c = CONS.find(([l]) => rest.startsWith(l));
    if (!c) { i += 1; continue; }
    let k = c[1];
    const after = word[i + c[0].length];
    if (c[0] === 'c' && after && 'eiy'.includes(after)) k = 'ಸ';
    if (c[0] === 't') k = after === 't' || word[i - 1] === 't' ? 'ಟ' : 'ತ'; // Mustafa, Bharat; Shetty, Mutton
    if (c[0] === 'd' && i + 1 === n) k = 'ಡ';              // Road, Ward (retroflex at the end)
    if (pending) {
      // n/m before most consonants is written as the anusvara: Chandana -> ಚಂದನ, Kempe -> ಕೆಂಪೆ
      if ((pending === 'ನ' || pending === 'ಮ') && out && !NO_ANUSVARA.has(k)) out += 'ಂ';
      else out += pending + VIRAMA;
    }
    pending = k;
    i += c[0].length;
  }
  if (pending) out += pending + VIRAMA;
  return out;
}

/** A token that isn't in the dictionary: acronym -> letter names, name/place -> Kannada letters. */
function convertToken(tok: string, allCaps = false): string {
  if (!LATIN.test(tok) || KANNADA.test(tok)) return tok;
  const m = /^([^A-Za-z]*)([A-Za-z.']+)([^A-Za-z]*)$/.exec(tok);
  if (!m) return tok;
  const [, pre, core, post] = m;
  const letters = core.replace(/[.']/g, '');
  // Initials and acronyms: "G", "R.", "VMJ", "BIET", "KSRTC"
  const acronym = /^[A-Z]{1,5}$/.test(letters) && (allCaps ? letters.length <= 3 : true);
  if (acronym) {
    const spelt = letters.split('').map((ch) => LETTER[ch]).join(letters.length > 1 && !core.includes('.') ? ' ' : '.');
    return pre + spelt + (letters.length === 1 || core.endsWith('.') ? '.' : '') + post;
  }
  return pre + transliterateWord(letters.toLowerCase()) + post;
}

/** Replaces dictionary phrases, then converts what's left word by word. */
function convertRun(text: string): string {
  // Brackets, commas, colons and hyphens stand apart so the words beside them still convert.
  const allCaps = text === text.toUpperCase();
  // (A colon between digits is a time - "10:30" stays together.)
  text = text.replace(/([A-Za-z])-([A-Za-z])/g, '$1 $2').replace(/([()[\],;–])/g, ' $1 ').replace(/(?<!\d):|:(?!\d)/g, ' : ');
  // Work on lower case for matching, keep the original for unknown words' capitalisation.
  const tokens = text.split(/(\s+)/);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (/^\s+$/.test(tok) || !tok) { out.push(tok); continue; }
    // try the longest dictionary phrase starting here
    let matched = false;
    for (const [phrase, kn] of PHRASES) {
      const words = phrase.split(' ');
      const slice: string[] = [];
      let j = i;
      for (let w = 0; w < words.length && j < tokens.length; w++) {
        if (w > 0) { if (!/^\s+$/.test(tokens[j] ?? '')) break; j++; }
        slice.push(tokens[j]);
        j++;
      }
      if (slice.length !== words.length) continue;
      const last = slice[slice.length - 1];
      const trail = /[^A-Za-z.'&]+$/.exec(last)?.[0] ?? '';
      const lead = /^[^A-Za-z.'&]+/.exec(slice[0])?.[0] ?? '';
      const cleaned = slice.map((s, idx) => {
        let t = s.toLowerCase();
        if (idx === 0) t = t.slice(lead.length);
        if (idx === slice.length - 1 && trail) t = t.slice(0, -trail.length);
        return t;
      });
      if (cleaned.join(' ') !== phrase && cleaned.join(' ').replace(/\.$/, '') !== phrase) continue;
      out.push(lead + kn + trail);
      i = j - 1;
      matched = true;
      break;
    }
    if (!matched) out.push(convertToken(tok, allCaps));
  }
  return out.join('').replace(/\s{2,}/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+([,.):])/g, '$1').trim();
}

const join = (a: string, b: string) => `${a.trim()} ಮತ್ತು ${b.trim()}`;

/**
 * English (or mixed) title / venue -> Kannada. Text that is already Kannada is returned unchanged.
 */
export function toKannada(input: string | null | undefined): string {
  let s = (input ?? '').trim();
  if (!needsKannada(s)) return s;
  s = s.replace(/\s+/g, ' ');
  // 10th -> 10ನೇ
  s = s.replace(/\b(\d+)\s*(?:st|nd|rd|th|ne)\b/gi, '$1ನೇ');

  // "Wedding(A weds B)", "Reception (A weds B)", "Engagement(A weds B)", "A weds B", "A and B Nikah"
  const couple = /^(.*?)(?:\s*[(:\-–]\s*|\s+)?(?:\b(?:wedding|marriage|marrige)\s+invitation\s*)?\(?\s*([^()]+?)\s+(?:weds|wed)\s+([^()]+?)\s*\)?\s*$/i.exec(s);
  if (couple) {
    const kind = couple[1].toLowerCase();
    const [a, b] = [convertRun(couple[2]), convertRun(couple[3])];
    const what = /reception|walima|valima/.test(kind)
      ? (/walima|valima/.test(kind) ? 'ವಲಿಮಾ' : 'ವಿವಾಹ ಆರತಕ್ಷತೆ')
      : /engagement|nishchith/.test(kind) ? 'ನಿಶ್ಚಿತಾರ್ಥ' : /nik/.test(kind) ? 'ನಿಖಾ' : 'ವಿವಾಹ';
    return `${join(a, b)} ರವರ ${what}`;
  }
  const pair = /^(.+?)\s+(?:and|&)\s+(.+?)\s+(nikah?|nikha|nikham|valima|walima|marriage|marrige|wedding|reception)\s*$/i.exec(s);
  if (pair) {
    const what = /val|wal/i.test(pair[3]) ? 'ವಲಿಮಾ' : /nik/i.test(pair[3]) ? 'ನಿಖಾ' : /reception/i.test(pair[3]) ? 'ವಿವಾಹ ಆರತಕ್ಷತೆ' : 'ವಿವಾಹ';
    return `${join(convertRun(pair[1]), convertRun(pair[2]))} ರವರ ${what}`;
  }
  // "Inauguration of X" / "Visit to X" -> "X ಉದ್ಘಾಟನೆ" / "X ಭೇಟಿ" (Kannada puts the action last)
  const ofX = /^(inauguration|inaugration|opening|visit)\s+(?:of|to)\s+(.+)$/i.exec(s);
  if (ofX) return `${convertRun(ofX[2])} ${/visit/i.test(ofX[1]) ? 'ಭೇಟಿ' : 'ಉದ್ಘಾಟನೆ'}`;
  // possessive: "Ravi's daughter wedding" -> "ರವಿ ರವರ ಮಗಳ ವಿವಾಹ"
  s = s.replace(/\b([A-Za-z]+)'s\b(?!\s*(?:wedding|reception))/gi, (m, name) => (/^(son|daughter)$/i.test(name) ? m : `${name} ರವರ`));
  return convertRun(s);
}
