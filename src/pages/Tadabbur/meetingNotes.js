export const meetingNoteLimit = 1000000;

export function meetingNote(notes) {
  if (Object.hasOwn(notes, 'meeting')) return notes.meeting;
  return {
    text: Object.entries(notes).filter(([, note]) => note.text?.trim()).map(([key, note]) =>
      key === 'private' ? note.text : 'Ayah ' + key + '\n' + note.text
    ).join('\n\n'),
    tag: ''
  };
}

