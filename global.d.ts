declare global {
  interface Window {
    cv: any
  }

  var cv: any
  const cv: any

}

declare namespace cv {
  class Mat {
    rows: number
    cols: number
    data: any
    delete(): void
  }
}


export {}
