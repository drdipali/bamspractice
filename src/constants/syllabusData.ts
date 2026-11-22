import { Chapter, Question, SamhitaDef } from '../types';

export const GROUPS = ['Major Samhitas', 'Minor Samhitas', 'BAMS subjects'];

export const RAW_TREE: SamhitaDef[] = [
  { name: 'Charaka Samhita', sthanas: [['Sutrasthana', 30], ['Nidanasthana', 8], ['Vimanasthana', 8], ['Sharirasthana', 8], ['Indriyasthana', 12], ['Chikitsasthana', 30]], groupIndex: 0 },
  { name: 'Sushruta Samhita', sthanas: [['Sutrasthana', 46], ['Nidanasthana', 16], ['Sharirasthana', 10], ['Chikitsasthana', 40]], groupIndex: 0 },
  { name: 'Ashtanga Hridaya', sthanas: [['Sutrasthana', 30], ['Sharirasthana', 6], ['Nidanasthana', 16], ['Chikitsasthana', 22]], groupIndex: 0 },
  { name: 'Madhava Nidana', sthanas: [['Nidana chapters', 69]], groupIndex: 1 },
  { name: 'Sharngadhara Samhita', sthanas: [['Purva Khanda', 7], ['Madhyama Khanda', 12], ['Uttara Khanda', 13]], groupIndex: 1 },
  { name: 'Bhavaprakasha', sthanas: [['Purva Khanda', 6], ['Madhyama Khanda', 80], ['Uttara Khanda', 10]], groupIndex: 1 },
  { name: 'Kashyapa Samhita', sthanas: [['Sutrasthana', 30], ['Nidanasthana', 8], ['Vimanasthana', 8], ['Sharirasthana', 8], ['Indriyasthana', 12], ['Chikitsasthana', 30], ['Siddhisthana', 12], ['Kalpasthana', 12]], groupIndex: 1 },
  { name: 'Bhela Samhita', sthanas: [['Sutrasthana', 30], ['Nidanasthana', 8], ['Vimanasthana', 8], ['Sharirasthana', 8], ['Indriyasthana', 12], ['Chikitsasthana', 30], ['Kalpasthana', 12], ['Siddhisthana', 12]], groupIndex: 1 },
  { name: 'Harita Samhita', sthanas: [['Prathamasthana', 18], ['Dvitiyasthana', 16], ['Tritiyasthana', 20], ['Chaturthasthana', 12], ['Panchamasthana', 14], ['Shashthasthana', 10]], groupIndex: 1 },
  { name: 'Yogaratnakara', sthanas: [['Purvardha', 50], ['Uttarardha', 30]], groupIndex: 1 },
  { name: 'Padartha Vigyan & Ayurveda Itihas', sthanas: [['Padartha Vigyan', 12], ['Ayurveda Itihas', 8]], groupIndex: 2 },
  { name: 'Sanskrit', sthanas: [['Vyakarana', 10], ['Subhashita & Shloka', 6]], groupIndex: 2 },
  { name: 'Rachana Sharir', sthanas: [['Shiras & Greeva', 6], ['Upashakha', 6], ['Madhya Sharira', 8], ['Asthi & Sandhi', 6]], groupIndex: 2 },
  { name: 'Kriya Sharir', sthanas: [['Dosha', 6], ['Dhatu & Mala', 8], ['Agni & Ahara', 4], ['Indriya & Manas', 6]], groupIndex: 2 },
  { name: 'Dravyaguna Vigyan', sthanas: [['Samanya Siddhanta', 10], ['Aushadhi Dravya', 20]], groupIndex: 2 },
  { name: 'Rasashastra & Bhaishajya Kalpana', sthanas: [['Rasashastra', 14], ['Bhaishajya Kalpana', 10]], groupIndex: 2 },
  { name: 'Agadatantra & Vyavahara Ayurveda', sthanas: [['Agadatantra', 10], ['Vyavahara Ayurveda', 6]], groupIndex: 2 },
  { name: 'Roga Nidana & Vikriti Vigyan', sthanas: [['Roga Nidana', 14], ['Vikriti Vigyan', 8]], groupIndex: 2 },
  { name: 'Swasthavritta & Yoga', sthanas: [['Swasthavritta', 14], ['Yoga', 4]], groupIndex: 2 },
  { name: 'Kayachikitsa', sthanas: [['Jwara to Rajayakshma', 12], ['Other systems', 14]], groupIndex: 2 },
  { name: 'Panchakarma', sthanas: [['Purvakarma & Pradhanakarma', 10]], groupIndex: 2 },
  { name: 'Shalya Tantra', sthanas: [['Shalya', 20]], groupIndex: 2 },
  { name: 'Shalakya Tantra', sthanas: [['Netra, Karna, Nasa, Mukha', 14]], groupIndex: 2 },
  { name: 'Prasuti & Stri Roga', sthanas: [['Prasuti', 8], ['Stri Roga', 6]], groupIndex: 2 },
  { name: 'Kaumarbhritya', sthanas: [['Kaumarbhritya', 10]], groupIndex: 2 },
];

export function buildSyllabus(): { chapters: Chapter[]; questionMap: Record<string | number, Question> } {
  const chapters: Chapter[] = [];
  const questionMap: Record<string | number, Question> = {};

  RAW_TREE.forEach((samhita, si) => {
    samhita.sthanas.forEach((sthana, ti) => {
      const sthanaName = sthana[0];
      const chapterCount = sthana[1];

      for (let n = 1; n <= chapterCount; n++) {
        const chapterId = chapters.length;
        const chapter: Chapter = {
          id: chapterId,
          name: `Chapter ${n}`,
          sam: samhita.name,
          sth: sthanaName,
          n: n,
          si: si,
          key: `${si}-${ti}`,
          qs: [],
        };
        chapters.push(chapter);
      }
    });
  });

  return { chapters, questionMap };
}

export const { chapters: ALL_CHAPTERS, questionMap: ALL_QUESTIONS } = buildSyllabus();

export function getChapterPath(chapter: Chapter): string {
  return `${chapter.sam} › ${chapter.sth} › Ch ${chapter.n}`;
}
