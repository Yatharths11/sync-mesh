function diffStrings(oldStr: string, newStr: string) {
  let prefixLen = 0;
  while (
    prefixLen < oldStr.length &&
    prefixLen < newStr.length &&
    oldStr[prefixLen] === newStr[prefixLen]
  ) {
    prefixLen++;
  }

  let oldEnd = oldStr.length;
  let newEnd = newStr.length;
  while (
    oldEnd > prefixLen &&
    newEnd > prefixLen &&
    oldStr[oldEnd - 1] === newStr[newEnd - 1]
  ) {
    oldEnd--;
    newEnd--;
  }

  const deletedLength = oldEnd - prefixLen;
  const insertedText = newStr.slice(prefixLen, newEnd);

  return { position: prefixLen, deletedLength, insertedText };
}

export { diffStrings };
