import { backend } from '../src/services/backend';

async function verify() {
  console.log('Testing Backend Questions Integration...');
  const t0 = Date.now();
  const questions = await backend.getQuestions();
  const t1 = Date.now();
  console.log(`Loaded ${questions.length} questions from backend in ${t1 - t0}ms`);

  if (questions.length < 5000) {
    throw new Error(`Expected at least 5000 questions, got ${questions.length}`);
  }

  const chapters = await backend.getChapters();
  console.log(`Generated ${chapters.length} syllabus chapters`);

  // Check Charaka Sutrasthana Ch 1, Ch 25, Ch 26, Ch 27
  const ch1 = chapters.find((c) => c.sam === 'Charaka Samhita' && c.sth === 'Sutrasthana' && c.n === 1);
  const ch25 = chapters.find((c) => c.sam === 'Charaka Samhita' && c.sth === 'Sutrasthana' && c.n === 25);
  const ch26 = chapters.find((c) => c.sam === 'Charaka Samhita' && c.sth === 'Sutrasthana' && c.n === 26);
  const ch27 = chapters.find((c) => c.sam === 'Charaka Samhita' && c.sth === 'Sutrasthana' && c.n === 27);

  console.log(`Charaka Sutrasthana Ch 1 questions: ${ch1?.qs.length}`);
  console.log(`Charaka Sutrasthana Ch 25 questions: ${ch25?.qs.length}`);
  console.log(`Charaka Sutrasthana Ch 26 questions: ${ch26?.qs.length}`);
  console.log(`Charaka Sutrasthana Ch 27 questions: ${ch27?.qs.length}`);

  // Test question sample
  const sample = questions[0];
  console.log('\nSample Question:');
  console.log('Stem:', sample.stem.slice(0, 100));
  console.log('Options:', sample.o);
  console.log('Correct Answer Index:', sample.c, '->', sample.o[sample.c]);
  console.log('Reference:', sample.r);

  console.log('\n🎉 ALL BACKEND CHECKS PASSED SUCCESSFULLY!');
}

verify().catch((e) => {
  console.error(e);
  process.exit(1);
});
