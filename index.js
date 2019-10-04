const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')
const client = require('scp2')

const defaultLaunch = {
  headless: process.env.NODE_ENV === 'production',
  devtools: process.env.NODE_ENV !== 'production',
  ignoreHTTPSErrors: true,
  slowMo: 0,
  defaultViewport: { width: 1220, height: 1080 },
  args: [
    '--disable-notifications',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-setuid-sandbox',
    // '--start-maxmized',
    // '--window-size=1920,1080',
    // '--start-fullscreen',
  ],
  // userDataDir: './chrome',
}

async function getLists(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".td_subject "), (tag) => {
      const aTagNum = Array.from(tag.querySelectorAll("a"))
      return {
        subject: tag.querySelector(".bo_tit ").textContent,
        url: aTagNum.length <= 1 ?
          aTagNum[0].getAttribute("href") :
          aTagNum[aTagNum.length - 1].getAttribute("href")

      }
    })
  })
}

async function getLink(page) {
  return await page.evaluate(() => {
    const tag = document.querySelectorAll("#bo_v_file")[1]
    const inLink = tag.querySelector("li > a")
    const targetExist = tag.querySelector("li>a[target]")
    return {
      url: inLink.getAttribute('href'),
      subject: inLink.textContent.trim(),
      click: inLink.click(),
      targetExist: targetExist,
    }
  })
}

function fileExistChecker(subject, path) {
  let fileExist = false
  try {
    const files = fs.readdirSync(path)
    for (let file of files) {
      if (subject.match(file)) {
        console.log(`${file} file exist`);
        fileExist = true
        break
      }
    }
  } catch (err) {
    console.log(err)
  }
  return fileExist
}

async function dotTorrentFileDownloader(browser, downloadPath, responseUrl) {
  await browser.waitForTarget(target => {
    return target.url() === responseUrl
  })
  let pages = await browser.pages()
  await pages[2].waitFor(2000)
  await pages[2]._client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });
//selector could change
  const selector = "#TencentCaptcha"
  await pages[2].waitFor(1000)
  await pages[2].waitForSelector(selector)
  await pages[2].waitFor(1000)
  await pages[2].click(selector)
  await pages[2].waitFor(3000)
  await pages[2].close()
  console.log("download")

}


/********* ********* ********* ********* ********* ********* ********* ********* *********
 실행부
 ********* ********* ********* ********* ********* ********* ********* ********* *********/
const crawler = async (subject, filePath, getNum) => {
  try {
    const downloadPath = './torrent-file'
    const browser = await puppeteer.launch(
      defaultLaunch
    )
    const page = await browser.newPage()
    await page.goto(subject)

    const lists = await getLists(page)

    //최신 파일만 검사.
    if (getNum) {
      lists.splice(getNum, lists.length - 1)
    }

    for (let list of lists) {
      await page.goto(list.url)

      const link = await getLink(page)

      // a[target] blank null 분기처리
      if (!link.targetExist) {
        // const fileExist = await fileExistChecker(link.subject, './file')
        // if (fileExist) {
        //   break
        // } else {
        link.click
        console.log(link.subject);
        await page._client.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: downloadPath
        });
        await page.waitFor(2000)
        console.log("download")
        // }
      } else {
        link.click
        console.log(link.subject);
        // const fileExist = await fileExistChecker(link.subject, filePath)
        // if (fileExist) {
        //   break
        // } else {
        await dotTorrentFileDownloader(browser, downloadPath, link.url)
        // }
      }
    }

    await page.waitFor(2000)
    await page.close()
    await browser.close()
  } catch (e) {
    console.error(e)
  }
}

function removeFiles() {
  const directory = './torrent-file';
  console.log("remove files")
  fs.readdir(directory, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(directory, file), err => {
        if (err) throw err;
      });
    }
  });
}

async function scpRun() {
  console.log("scp running")
   client.scp('./torrent-file/*', {
    host: 'allselect.iptime.org',
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
    path: '/home/pi/hdd/watch/'
  }, function(err) {

   })
}

const torrentbeUrl = "https://www.torrentbe.net"

const krDrama = (string) => {
  return `${torrentbeUrl}/bbs/board.php?bo_table=kr_drama&sca=&sop=and&sfl=wr_subject&stx=${encodeURIComponent(string)}`
}
const krEnt = (string) => {
  return `${torrentbeUrl}/bbs/board.php?bo_table=kr_ent&sca=&sop=and&sfl=wr_subject&stx=${encodeURIComponent(string)}`
}
const krMusic = (string) => {
  return `${torrentbeUrl}/bbs/board.php?bo_table=music&sca=&sop=and&sfl=wr_subject&stx=${encodeURIComponent(string)}`
}

const subject = krDrama("멜로가 체질");

(async () => {
  // await crawler(subject)
  await scpRun()
  await removeFiles()
})()
