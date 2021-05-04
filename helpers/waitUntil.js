module.exports = function (fromObject, ...wantToCheckValueIsExist) {
  let start = Date.now()
  let x = 0;
  return new Promise((resolve, reject) => {
    try {
      const until = setInterval(function () {
        let check = true
        for (const each of wantToCheckValueIsExist) {
          check = check && typeof fromObject[each] != 'undefined'
        }
        if (check) {
          clearInterval(until)
          return resolve()
        }
        process.stdout.write(`\r ${["\\", "|", "/", "-"][x++]} `);
        x &= 3;
        if (Date.now() - start > 3000) {
          clearInterval(until)
          return reject(`Wait Until TimeOut ${wantToCheckValueIsExist.join(' ')}`)
        }
      }, 0)
    } catch (error) {
      return reject(`Wait Until Error ${wantToCheckValueIsExist.join(' ')} ${error}`)
    }
  });
}