module.exports = function (fromObject, ...wantToCheckValueIsExist) {
  const start = Date.now()
  let x = 0;
  let check = true
  let callback = null

  return new Promise((resolve, reject) => {
    try {
      for (const each of wantToCheckValueIsExist) {
        if (typeof each == 'function') {
          callback = each;
          continue;
        }
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
          check = check && typeof fromObject[each] != 'undefined'
        }
        if (check) {
          clearInterval(until)
          if (typeof callback == 'function') return callback(resolve, reject)
          return resolve()
        }
        process.stdout.write(`\rLoading ${["\\", "|", "/", "-"][x++]}`);
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