#!/bin/bash
# lint the concatenated modules for undefined names, redeclarations and similar slips
# usage: tools/lint.sh [module prefixes...]
SP=$(cd "$(dirname "$0")/.." && pwd)
OUT=$SP/tools/lint/all.js
: > $OUT
for f in $(ls $SP/src/[0-9][0-9]_*.js | sort); do
  b=$(basename $f); p=${b:0:2}
  if [ $# -gt 0 ]; then ok=0; for a in "$@"; do [ "$p" == "$a" ] && ok=1; done; [ $ok == 1 ] || continue; fi
  echo "/* @@FILE $b */" >> $OUT; cat $f >> $OUT; echo >> $OUT
done
cd $SP/tools/lint && eslint -c eslint.config.mjs -f json all.js | node -e '
const fs=require("fs");const src=fs.readFileSync(process.argv[1],"utf8").split("\n");const marks=[];src.forEach((l,i)=>{const m=l.match(/^\/\* @@FILE (\S+) \*\//);if(m)marks.push([i+1,m[1]])});
let js;try{js=JSON.parse(fs.readFileSync(0,"utf8"))}catch(e){console.log("eslint output not JSON");process.exit(1)}
const cnt={};for(const r of js)for(const m of r.messages){const n=m.line;let f="?",s=0;for(const [ln,name] of marks){if(ln<=n){f=name;s=ln}}console.log(f+":"+(n-s)+":"+m.column+": "+(m.severity==2?"E":"w")+" "+m.message+" ["+(m.ruleId||"")+"]");cnt[m.ruleId]=(cnt[m.ruleId]||0)+1}
console.log("summary",JSON.stringify(cnt))' $OUT
