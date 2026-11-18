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

const AO = [
  'Both A and R are true and R is the correct explanation of A',
  'Both A and R are true but R is NOT the correct explanation of A',
  'A is true but R is false',
  'A is false but R is true',
];

const AOH = [
  '(A) और (R) दोनो सही है और (R), (A) की सही व्याख्या है',
  '(A) और (R) दोनो सही है परंतु (R), (A) की सही व्याख्या नहीं है',
  '(A) सही है परंतु (R) सही नहीं है',
  '(A) सही नहीं है परंतु (R) सही है',
];

const RAW_REAL = [
  'According to Acharya Charak, how many Karana dravyas are there?|4|7|9|6|c|1/48',
  'Which of the following is NOT a parthiva dravya?|Samalah|Gairika|Suvarna|Gorochana|d|1/70',
  'What are the types of Audbhida dravya?|Vanaspati|Virudh|Vanaspatya|All of the above|d|1/71',
  'AR|Tridanda is sattva, atma and sharira.|Tridanda is vata, pitta and kapha.|c|1/46',
  'How many gunas are mentioned in Ayurveda in total?|19|41|42|10|b|1/49',
  'The line “sa nityo yatra hi dravyam” refers to which of these?|Samavaya|Samanya|Guna karma|Samyoga|a|1/50',
  'Which of the following is NOT a disciple of Atreya?|Jatukarna|Bhela|Harita|Kashyapa|d|1/31',
  'AR|Karana dravyas are 7 in number.|Karana dravyas are 9 in number.|d|1/48',
  'Which of the following is NOT a twak-upayogi vriksha?|Snuhi|Ashmantaka|Krishnagandha|Putika|b|1/115',
  'Putika and tilvaka are used in which procedure?|Nasya|Basti|Virechana|All of the above|c|1/117',
  'AR|Jnana devatas are 8 in number.|Jnana devatas are 10 in number.|c|1/39',
  '“Hitahitam sukham duhkham ayus tasya hitahitam” is the reference of which chapter?|Charaka Sutra 16|Charaka Sutra 26|Charaka Sutra 1|Charaka Sutra 30|c|1/41',
  'Tulyarthata hi ... (completes the verse)|Guna|Vishesha|Samanya|Samavaya|c|1/45',
  'AR|Gurvadi gunas are 20 in number.|They are also called sharira gunas.|a|1/49',
  'Which guna is common to pitta and kapha?|Snigdha|Sheeta|Chala|Ruksha|a|1/60-61',
  'What is the combination of sharira, indriya, sattva and atma called?|Ayu|Arogya|Jivita|A and C|d|1/42',
  'AR|Nishcheshta karana is dravya.|Nishcheshta karana is guna.|d|1/51',
  'What is the prayojyanga of Krishnagandha?|Flower|Leaf|Bark|Fruit|c|1/117',
  'By source, dravya is divided into how many groups?|One|Three|Two|Seven|b|1/68',
  'AR|Drishti pashyati hi kriya is atma.|Drishti pashyati hi kriya is pratyaksha.|c|1/56',
  'Which of the following is false?|Tulyarthata hi samanyam|Visheshastu prithaktvakrit|Both a and b|None of the above|d|1/45',
  'Who is the tantrakarta of Charaka Samhita?|Bhela|Atreya Punarvasu|Agnivesha|Charaka|c|1/140',
  'AR|Charaka mentions 7 gunas for vata, pitta and kapha.|Sheeta is a guna of both vata and kapha.|b|1/59-61',
  'Who is the adi vyakhyakara of Charaka Samhita?|Punarvasu Atreya|Agnivesha|Charaka|Jatukarna|a|1/30',
  'Which rishi is first mentioned as seeking long life?|Charaka|Atreya|Agnivesha|Bharadvaja|d|1/3',
  'AR|Based on origin, dravya is of 3 types.|They are jangama, audbhida and parthiva.|a|1/68',
  'Which guna is common to vata and kapha?|Sara|Sheeta|Ruksha|Laghu|b|1/59,61',
  'How many gunas are mentioned in the Charaka Samhita in total?|40|41|17|24|b|1/49',
  'AR|Vata is an example of vanaspati.|Vata is an example of vanaspatya.|c|1/71',
  'Which ksheerini vriksha is used only for virechana?|Jyotishmati|Snuhi|Krishnagandha|Ashmantaka|b|1/115',
  'Which mulini dravya is used for virechana?|Ashmantaka|Kunduru|Malakangani|Ajagandha|d|1/78-79',
  'AR|Five types of lavana are mentioned in this chapter.|Among them saindhava is considered best.|b|1/88',
  'Which is NOT included in ashtavidha ksheera?|Oshtra ksheera|Khara ksheera|Aushtra ksheera|Nari ksheera|b|1/106',
  'How many ksheera-pradhana vrikshas are there?|8|2|6|3|d|1/115',
  'AR|Arka ksheera is used for vamana and virechana.|Ashmantaka is used for virechana.|c|1/115',
  'How many padarthas does Ayurveda count?|6|7|8|10|a|1/28',
  'What is the cause of hrasa (decrease)?|Samavaya|Asamavaya|Abhava|Vishesha|d|1/44',
  'AR|Atma gunas are 6 in number.|Paradi gunas are 10 in number.|b|1/49',
  'Which mutra is used in arsha?|Mahisha|Hasti|Oshtra|All of the above|d|1/96',
  'Which of the shat padarthas is nishcheshta and samavayi?|Dravya|Guna|Karma|Both B and C|b|1/51',
  'Which mulini dravya is NOT advised for vamana?|Shanapushpi|Aparajita|Shweta|Both B and C|b|1/80',
  'AR|Manasika doshas are 3 in number.|Manasika doshas are 2 in number.|d|1/57',
  'Urine of which animal is used in unmada?|Avi|Cow|Khara|Mahisha|c|1/104',
  'How many gunas are there in gurvadi (sharira) gunas?|11|20|30|41|b|1/49',
  'Ayurveda is concerned with which kind of ayu?|Hita|Ahita|Dukha|All of the above|d|1/41',
  'AR|Ekatvakara is samanya.|Ekatvakara is vishesha.|c|1/45',
  'Sasneha (ishat snigdha) is a property of which dosha?|Pitta|Vata|Kapha|None of the above|a|1/60',
  'Vata, ashvattha and udumbara fall under which audbhida group?|Sattva|Vanaspati|Vanaspatya|Virudha|b|1/71-72',
  'Which types of vaidya are mentioned in this chapter?|Ajna vaidya|Chadmachara vaidya|Shreshtha chikitsaka|All of the above|d|1/123-131',
  'Anubandha is a synonym of which?|Sharira|Atma|Ayu|Sattva|c|1/42',
  'Katu and lavana are the primary attributes of which?|Pitta|Sura|Mutra|Both B and C|c|1/94',
  'AR|Aprithagbhava is samavaya.|Aprithagbhava is guna.|c|1/50',
  'Which is NOT in the group with Putika, Krishnagandha and Tilvaka?|Putika|Chitraka|Krishnagandha|Tilvaka|b|1/117',
  'Kampillaka is counted in which group?|Ksheera dravya|Phalini dravya|Parthiva dravya|None of the above|b|1/83',
  'How many phalini dravyas are there?|15|19|35|20|b|1/74',
  'AR|Lavana is deepaniyatama.|It can be used for shastra karma.|b|1/89-91',
  'Which nyaya does Chakrapani use to explain the word “param”?|Gobalivarda nyaya|Kedarkulya nyaya|Khalekapota nyaya|None of the above|a|1/25',
  'Krishnagandha twak is useful in which condition?|Vidradhi|Visarpa|Kushtha|All of the above|d|1/118',
  'Which pair does NOT match, in Chakrapani’s view?|Sarvapraanishu atmaniva buddhi-maitri|Aviplutagama - avicchinna parampara|Jnana-pratisandhata - mana|None of the above|c|1/26',
  'The maharishis acquired knowledge of the shat padarthas through which?|Eka chakshu|Jnana chakshu|Charma chakshu|Unmilita chakshu|b|1/28',
  'AR|Madhu is jangama dravya.|Madhu is audbhida dravya.|c|1/68-69',
  'The term “Balahantar” refers to whom?|Indra|Brahma|Atreya|Bharadvaja|a|1/20',
  'Why is Indra called Shakra?|Capable of protecting the needy|Expert in Ayurveda|Killed a demon named Shakra|None of the above|a|1/17',
  'In which Sutrasthana chapter is Trisutra Ayurveda mentioned?|Sutrasthana 28|Sutrasthana 11|Sutrasthana 29|Sutrasthana 1|d|1/24',
  'The Kakadanta pariksha is described by Chakrapani in relation to what?|Shastra nishprayojanata|Dashavidha atura pariksha|Mukha roga|Both B and C|a|1/1',
  'In which Sutrasthana chapter is the verse on the six rasas (“svadur amlo atha lavanah…”) found?|1|2|3|4|a|1/65',
  'AR|Uttama arogya mula is 4 in number.|They are dharma, artha, kama and moksha.|a|1/15',
  'Who is worshipped in Chakrapani’s mangalacharana of Ayurveda Dipika?|Brahma|Mahesha|Saraswati|All of the above|d|1/1',
  'With which word does the first chapter of Charaka Samhita begin?|Atha|Ataha|Ayushkamiya|Adhyaya|a|1/1',
  'How many padas does “Athato dirghanjivitiyam adhyayam vyakhyasyamah” have?|4|3|6|8|d|1/1',
  'Which mutra has sara guna?|Avi|Aushtra|Mahisha|Vaji|c|1/102',
  'Which is NOT included in panchalavana?|Sauvarchala|Audbhida|Samudra|Romaka|d|1/88',
  'AR|Sharira dosha prashamana aushadhis are 2 in number.|Manasa dosha prashamana aushadhis are 5 in number.|b|1/58',
  'What is the chikitsa sutra of manasika dosha?|Vijnana, dhi, dhairya, samadhi|Jnana, vijnana, dhi, dhairya, smriti|Jnana, vijnana, yoga, smriti, samadhi|Jnana, vijnana, dhairya, smriti, samadhi|d|1/58',
  'Which is used for shirovirechana?|Shweta|Jyotishmati|Ajagandha|Both A and B|d|1/79',
  'Which is the cause of prithaktva?|Guna|Vishesha|Samanya|Dravya|b|1/45',
  '“Samanyam ekatvakaram” belongs to which group?|Karma vishesha|Dravya samanya|Karma samanya|Dravya vishesha|b|1/45',
  'What does vanaspatya mean?|Pushpa|Phalaih|Phalapakantah|Pushpaih phalaih api|d|1/72',
  'AR|Audbhida dravyas are 4 in number.|They are vanaspati, vanaspatya, virudh and aushadhi.|a|1/71-72',
  '“Nakra reto vrishyanam” follows which moulik siddhanta?|Guna samanya|Dravya samanya|Karma samanya|Dravya vishesha|b|1/44',
  'Which mutra is NOT part of ashtavidha mutra?|Avi|Nara|Khara|Mahisha|b|1/93',
  'How many mulini dravyas are mentioned in this chapter?|16|19|6|15|a|1/74',
  'Which of these is a phalini dravya?|Jyotishmati|Hastiparni|Ajagandha|None of these|b|1/82',
  'Fill in the blank: “Nirvrittau cha vishese cha ... khadayas trayah”|Rasanartho|Pathyaya|Svadva|Pratyayah|d|1/64',
  'AR|Adhishthana of rasa are prithvi and jala.|Vishesha karana of rasa are kha, anila and anala.|b|1/64',
  'The verse “Vayuh pittam kaphash choktah…” is from which chapter?|4|14|24|1|d|1/57',
  'Which fruit is used for nasya karma?|Haritaki|Trapusha|Apamarga|All of the above|c|1/85',
  'The verse “Nirvikarah parastvatma…” is from which chapter?|10|5|1|None of these|c|1/56',
  'Which is NOT a characteristic of mutra?|Katu|Ushna|Tikshna|Snigdha|d|1/94',
  'AR|Based on karma, dravya is of 3 types.|They are doshaprashamana, dhatupradushana and swasthahita.|a|1/67'
];

const RAW_HI: Record<number, string> = {
  0: 'आचार्य चरक के मतानुसार कारण द्रव्यों की संख्या कितनी है?||||',
  1: 'आचार्य चरक के मतानुसार निम्न में से कौनसा पार्थिव द्रव्य नहीं हो सकता है?|समलाः|गैरिक|सुवर्ण|गोरोचन',
  2: 'आचार्य चरक के मतानुसार औद्भिद द्रव्य के भेद हैं?|वनस्पति|वीरुध|वानस्पत्य|सभी',
  3: 'त्रिदण्ड सत्व, आत्म और शरीर है।|त्रिदण्ड वात, पित्त और कफ है।',
  4: 'आचार्य चरक के मतानुसार आयुर्वेदोक्त कुल गुणों की संख्या कितनी है?||||',
  5: 'आचार्य चरक के मतानुसार “स नित्यो यत्र हि द्रव्यं” यह पंक्ति किसके लिए कही गयी है?|समवाय|सामान्य|गुण कर्म|संयोग',
  6: 'आचार्य चरक के मतानुसार निम्न में से आत्रेय के शिष्य कौन नहीं हैं?|जतूकर्णः|भेल|हारित|काश्यप',
  7: 'कारण द्रव्य संख्या में 7 हैं।|कारण द्रव्य संख्या में 9 हैं।',
  8: 'आचार्य चरक के मतानुसार निम्न में से कौन त्वक उपयोगी वृक्ष नहीं है?|स्नुही|अश्मन्तक|कृष्णगन्धा|पूतिक',
  9: 'आचार्य चरक के मतानुसार पूतिक और तिल्वक का उपयोग कहाँ करते हैं?|नस्य|बस्ति|विरेचन|सभी',
  10: 'ज्ञान देवता संख्या में 8 हैं।|ज्ञान देवता संख्या में 10 हैं।',
  11: '“हिताहितं सुखं दुःखमायुस्तस्य हिताहितम्” यह किस अध्याय का सन्दर्भ है?|चरक सूत्र 16|चरक सूत्र 26|चरक सूत्र 1|चरक सूत्र 30',
  12: 'तुल्यार्थता हि .... (श्लोक पूर्ण कीजिए)|गुण|विशेषम्|सामान्यम्|समवायम्',
  13: 'गुर्वादि गुण 20 संख्या में हैं।|उन्हें शारीर गुण भी कहा जाता है।',
  14: 'आचार्य चरक के मतानुसार पित्त और कफ में समान गुण कौन सा है?|स्निग्ध|शीत|चल|रूक्ष',
  15: 'आचार्य चरक के मतानुसार शरीर, इन्द्रिय, सत्त्व और आत्मा के संयोग को क्या कहते हैं?|आयु|आरोग्य|जीवित|A + C',
  16: 'निश्चेष्ट करण द्रव्य है।|निश्चेष्ट करण गुण है।',
  17: 'आचार्य चरक के मतानुसार कृष्णगन्धा का प्रयोज्याङ्ग क्या है?|पुष्प|पत्र|त्वक|फल',
  18: 'आचार्य चरक के मतानुसार उत्पत्ति के आधार पर द्रव्य कितने प्रकार के हैं?|एक प्रकार|तीन प्रकार|दो प्रकार|सात प्रकार',
  19: 'दृष्टि पश्यति हि क्रिया आत्म है।|दृष्टि पश्यति हि क्रिया प्रत्यक्ष है।',
  20: 'आचार्य चरक के मतानुसार निम्न में से गलत कौन सा है?|तुल्यार्थता हि सामान्यं|विशेषस्तु पृथक्त्वकृत्|दोनों A और B|इनमें से कोई नहीं',
  21: 'आचार्य चरक के मतानुसार चरक संहिता का तन्त्रकर्ता कौन है?|भेल|आत्रेय पुनर्वसु|अग्निवेश|चरक',
  22: 'चरक में वात, पित्त और कफ के लिए 7 गुणों का उल्लेख है।|शीत वात और कफ दोनों का गुण है।',
  23: 'आचार्य चरक के मतानुसार चरक संहिता के आदि व्याख्याकार कौन हैं?|पुनर्वसु आत्रेय|अग्निवेश|चरक|जतूकर्णः',
  24: 'आचार्य चरक के मतानुसार दीर्घजीवन की खोज में किस ऋषि का सर्वप्रथम उल्लेख है?|चरक|आत्रेय|अग्निवेश|भरद्वाज',
  25: 'मूल के आधार पर द्रव्य 3 प्रकार का है।|वे जांगम, औद्भिद और पार्थिव हैं।',
};

export function buildSyllabus(): { chapters: Chapter[]; questionMap: Record<string | number, Question> } {
  const chapters: Chapter[] = [];
  const questionMap: Record<string | number, Question> = {};
  let qid = 0;

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

        // If this is Chapter 0 (Charaka Sutrasthana Ch 1), populate with 90 real questions
        if (chapterId === 0) {
          RAW_REAL.forEach((item, index) => {
            const parts = item.split('|');
            let q: Question;
            const qRealId = 100001 + index;
            const diff: 0 | 1 | 2 = 0;

            if (parts[0] === 'AR') {
              const correctKey = parts[3];
              q = {
                id: qRealId,
                ch: chapterId,
                chapterName: `${samhita.name} > ${sthanaName} > Chapter ${n}`,
                questionType: 'assertion_reason',
                assertionText: parts[1],
                reasonText: parts[2],
                d: diff,
                c: 'abcd'.indexOf(correctKey),
                stem: `Given below are two statements:\nStatement A: ${parts[1]}\nStatement R: ${parts[2]}`,
                o: AO,
                r: parts[4],
              };
            } else {
              const correctKey = parts[5];
              q = {
                id: qRealId,
                ch: chapterId,
                chapterName: `${samhita.name} > ${sthanaName} > Chapter ${n}`,
                questionType: 'standard',
                d: diff,
                c: 'abcd'.indexOf(correctKey),
                stem: parts[0],
                o: parts.slice(1, 5),
                r: parts[6],
              };
            }

            // Bind Hindi translation if available
            if (RAW_HI[index]) {
              const hiParts = RAW_HI[index].split('|');
              if (q.stem.startsWith('Given below')) {
                q.hi = {
                  stem: `नीचे दिए गए दो कथन हैं:\nकथन A: ${hiParts[0]}\nकथन R: ${hiParts[1]}`,
                  o: AOH,
                };
              } else {
                q.hi = {
                  stem: hiParts[0],
                  o: hiParts.slice(1, 5).some(Boolean) ? hiParts.slice(1, 5) : q.o,
                };
              }
            }

            chapter.qs.push(q);
            questionMap[q.id] = q;
          });
        } else {
          // Synthetic questions pool for other chapters
          const k = ((chapterId * 37 + n * 11) % 45) + 8;
          for (let j = 0; j < k; j++) {
            const currentQid = ++qid;
            const diff = ((j + chapterId) % 3) as 0 | 1 | 2;
            const correctOpt = (currentQid * 7 + j) % 4;
            const q: Question = {
              id: currentQid,
              ch: chapterId,
              chapterName: `${chapter.sam} > ${chapter.sth} > Chapter ${chapter.n}`,
              questionType: 'standard',
              d: diff,
              c: correctOpt,
              stem: `Classical Question #${currentQid} from ${chapter.sam}, ${chapter.sth} Chapter ${chapter.n}. Identify the correct authoritative principle:`,
              o: [
                `Principle A (${chapter.sth} ref #${(j % 5) + 1})`,
                `Principle B (${chapter.sth} ref #${(j % 5) + 2})`,
                `Principle C (${chapter.sth} ref #${(j % 5) + 3})`,
                `Principle D (${chapter.sth} ref #${(j % 5) + 4})`,
              ],
              r: `${chapter.sth} Ch ${chapter.n}/${(j % 30) + 1}`,
              hi: {
                stem: `${chapter.sam}, ${chapter.sth} अध्याय ${chapter.n} से प्रश्न #${currentQid}: सही विकल्प चुनिए:`,
                o: [
                  `सिद्धान्त A (सन्दर्भ #${(j % 5) + 1})`,
                  `सिद्धान्त B (सन्दर्भ #${(j % 5) + 2})`,
                  `सिद्धान्त C (सन्दर्भ #${(j % 5) + 3})`,
                  `सिद्धान्त D (सन्दर्भ #${(j % 5) + 4})`,
                ],
              },
            };
            chapter.qs.push(q);
            questionMap[q.id] = q;
          }
        }

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
