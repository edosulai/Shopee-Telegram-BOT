module.exports = function (fromObject, ...wantToCheckValueIsExist) {
  const start = Date.now()
  let x = 0;
  let wantToCheck = null;
  let check = true
  let callback = null
  let timeOut = 3000

  return new Promise((resolve, reject) => {
    try {
      for (const each of wantToCheckValueIsExist) {
        if (typeof each == 'function') {
          callback = each;
          continue;
        } else if (typeof each == 'number') {
          timeOut = each;
          continue;
        }
        wantToCheck = each;
        check = check && typeof fromObject[each] != 'undefined'
      }
      if (check) {
        if (typeof callback == 'function') return callback(resolve, reject)
        return resolve()
      }

      const until = setInterval(function () {
        check = true
        for (const each of wantToCheckValueIsExist) {
          if (typeof each == 'function') {
            callback = each;
            continue;
          }
          wantToCheck = each;
          check = check && typeof fromObject[each] != 'undefined'
        }
        if (check) {
          clearInterval(until)
          if (typeof callback == 'function') return callback(resolve, reject)
          return resolve()
        }

        // process.stdout.write(`\rLoading ${["\\", "|", "/", "-"][x++]}`);
        x &= 3;
        if (Date.now() - start > timeOut) {
          clearInterval(until)
          return reject(`${wantToCheck} Timeout ${timeOut}`)
        }
      }, 0)
    } catch (error) {
      return reject(`${wantToCheck} TimeOut Error ${error}`)
    }
  });
}