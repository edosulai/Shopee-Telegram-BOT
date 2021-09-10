module.exports = function (fromObject, ...wantToCheckValueIsExist) {
  const start = Date.now()
  let x = 0;
  let wahtToCheck = null;
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
        wahtToCheck = each;
        if (typeof each == 'boolean'){
          check = check && each
        } else {
          check = check && typeof fromObject[each] != 'undefined'
        }
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
          wahtToCheck = each;
          if (typeof each == 'boolean'){
            check = check && each
          } else {
            check = check && typeof fromObject[each] != 'undefined'
          }
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
          return reject(`${wahtToCheck} Timeout ${timeOut}`)
        }
      }, 0)
    } catch (error) {
      return reject(`${wahtToCheck} TimeOut Error ${error}`)
    }
  });
}