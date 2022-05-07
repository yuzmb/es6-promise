// 定义Promise的状态
const PENDING = 'pending'
const REJECTED = 'rejected'
const FULFILLED = 'fulfilled'

class MyPromise {
  constructor(callback) {
    this.currentState = PENDING // Promise当前的状态
    this.value = void 0 // Promise的值
    this.onResolveCallbacks = [] // Promise resolve回调函数
    this.onRejectCallbacks = [] // Promise reject回调函数

    // resolve 处理函数
    const resolve = (value) => {
      if (value instanceof MyPromise) {
        // 如果 value 是个 Promise， 递归执行
        value.then(resolve, reject)
      }
      // 异步执行
      setTimeout(() => {
        if (this.currentState === PENDING) {
          this.currentState = FULFILLED // 修改状态
          this.value = value
          this.onResolveCallbacks.forEach((cb) => cb()) // 执行回调
        }
      })
    }

    // reject 处理函数
    const reject = (value) => {
      // 异步执行
      setTimeout(() => {
        if (this.currentState === PENDING) {
          this.currentState = REJECTED
          this.value = value
          this.onRejectCallbacks.forEach((cb) => cb())
        }
      })
    }

    try {
      // 执行callback并传入相应的参数
      callback(resolve, reject)
    } catch (error) {
      reject(error)
    }
  }

  // 用箭头函数就不用绑定this
  // then 方法接受两个参数，onFulfilled，onRejected，分别为Promise成功或失败的回调
  then = (onFulfilled, onRejected) => {
    // onFulfilled、onRejected不是函数需要忽略，同时也实现了值穿透。它们都是可选参数
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : (value) => value
    onRejected =
      typeof onRejected === 'function'
        ? onRejected
        : (error) => {
            throw error
          }

    if (this.currentState === FULFILLED) {
      // 如果promise的状态已经确定并且为fulfilled，我们调用onFulfilled
      // 如果考虑到有可能throw，所以我们将其包在try/catch块中
      return new MyPromise((resolve, reject) => {
        setTimeout(() => {
          try {
            const x = onFulfilled(this.value)
            // 如果 onFulfilled 的返回值是一个 Promise 对象，直接取它的结果，否则取它的值
            if (x instanceof MyPromise) {
              x.then(resolve, reject)
            }
            resolve(x)
          } catch (error) {
            reject(error)
          }
        })
      })
    }

    if (this.currentState === REJECTED) {
      return new MyPromise((resolve, reject) => {
        setTimeout(() => {
          try {
            const x = onRejected(this.value)
            if (x instanceof MyPromise) {
              x.then(resolve, reject)
            }
            resolve(x)
          } catch (error) {
            reject(error)
          }
        })
      })
    }

    // 如果当前的Promise还处于PENDING状态，我们并不能确定调用onFulfilled还是onRejected
    // 只有等待Promise的状态确定后，再做处理
    // 所以我们需要把我们的两种情况的处理逻辑做成callback放入promise（此处即this）的回调数组内
    // 处理逻辑和以上相似
    if (this.currentState === PENDING) {
      return new MyPromise((resolve, reject) => {
        this.onResolveCallbacks.push(() => {
          try {
            const x = onFulfilled(this.value)
            if (x instanceof MyPromise) {
              x.then(resolve, reject)
            }
            resolve(x)
          } catch (error) {
            reject(error)
          }
        })

        this.onRejectCallbacks.push(() => {
          try {
            const x = onRejected(this.value)
            if (x instanceof MyPromise) {
              x.then(resolve, reject)
            }
            resolve(x)
          } catch (error) {
            reject(error)
          }
        })
      })
    }
  }

  catch = (onRejected) => {
    return this.then(null, onRejected)
  }

  // 静态resolve 方法
  static resolve(value) {
    return value instanceof MyPromise ? value : new MyPromise((resolve) => resolve(value))
  }

  // 静态reject方法
  static reject(error) {
    return new MyPromise((resolve, reject) => reject(error))
  }

  // 静态all方法
  // MyPromise.all可以将多个Promise实例包装成一个新的Promise实例。同时，成功和失败的返回值是不同的，成功的时候返回的是一个结果数组，而失败的时候则返回最先被reject失败状态的值
  static all(promisesArr) {
    let count = 0
    const result = []
    return new MyPromise((resolve, reject) => {
      if (!promisesArr.length) return resolve(result)

      promisesArr.forEach((item, index) => {
        MyPromise.resolve(item).then(
          (value) => {
            count++
            result[index] = value
            if (count === result.length) {
              resolve(result)
            }
          },
          (error) => {
            reject(error)
          }
        )
      })
    })
  }

  // 静态race 方法
  // MyPromise.race([p1, p2, p3])里面哪个结果返回的快，就返回那个结果，不管结果本身是成功状态还是失败状态
  static race(promiseArr) {
    return new MyPromise((resolve, reject) => {
      promiseArr.forEach((item) => {
        MyPromise.resolve(item).then(resolve, reject)
      })
    })
  }

  // 静态allSettled
  // all方法如果遇到reject后，只会输出reject。allSettled不管每个promise的状态是成功还是失败，返回全部包括状态的对象数组
  static allSettled(promises) {
    return new MyPromise((resolve, reject) => {
      promises = Array.isArray(promises) ? promises : []
      let len = promises.length
      const argsLen = len
      if (len === 0) return resolve([])
      // let args = Array.prototype.slice.call(promises)
      let args = [...promises]
      const resolvePromise = (index, value) => {
        // 判断传入的是否是object
        if (typeof value === 'object') {
          const then = value.then
          if (typeof then === 'function') {
            then.call(
              value,
              (val) => {
                args[index] = { status: FULFILLED, value: val }
                if (--len === 0) {
                  resolve(args)
                }
              },
              (e) => {
                args[index] = { status: REJECTED, reason: e }
                if (--len === 0) {
                  reject(args)
                }
              }
            )
          }
        }
      }

      for (let i = 0; i < argsLen; i++) {
        resolvePromise(i, args[i])
      }
    })
  }
}
