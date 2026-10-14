function isBafangSafeToWrite(deviceName) {
  if (!deviceName) return false;
  const lower = deviceName.toLowerCase();

  // Explicitly risky models (Blacklist)
  if (lower.includes('m560') || lower.includes('m820') || lower.includes('c245')) {
    return false;
  }

  // Known safe models (Whitelist)
  const safePrefixes = [
    'aeg', 'prophete', 'e-novation', 'e_novation', 'fischer',
    '8fun', 'eightfun', 'm400', 'm420', 'm500', 'm510', 'm600', 'm620', 'm615',
    'go+', 'c24', 'c26', 'c27', 'dp-c'
  ];

  for (const prefix of safePrefixes) {
    if (lower.includes(prefix)) {
      return true;
    }
  }

  return false;
}
console.log(isBafangSafeToWrite('bafang m560')); // false
console.log(isBafangSafeToWrite('bafang c245')); // false
console.log(isBafangSafeToWrite('bafang m400')); // true
console.log(isBafangSafeToWrite('bafang unknown')); // false
