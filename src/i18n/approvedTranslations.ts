YªçŠx-®éÜj×¢ëiºÚ+Š§j[h‘éÜ¢éíëŸ8å:-jZ.¶›­–)Ş³VW‡÷'BG—RÆæwVvRÒ&–B"Â&Vâ#° ¢ò¢ ¢¢6‡&öÖRÖÆWfVÂ†æb÷6–FV&"÷7FGW2öÆöv–â’7G&–æw2ÂÇW2F†R6&&öâÖöGVÆP¢¢†fVGW&W2ö6&&öâò¢¢²F†Rô’N¹ïm¢G§²ÚîÆ­yĞ return template.replace(/\{(\w+)\}/g, (match, key) => {
    const val = params[key];
    return val === undefined ? match : String(val);
  });
}
