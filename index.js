const express = require("express")
const serveStatic = require('serve-static')
const { option } = require('yargs')
const { address } = require('ip')
const publicIp = import('public-ip')
const Path = require('path')
const fs = require('fs-extra')
const trash = require('trash')
const archiver = require("archiver")
const StreamZip = require('node-stream-zip')
const bodyParser = require('body-parser')

const exec = require('child_process').exec
// const process = require('process')


const multer  = require('multer')
const upload = multer()



const { argv } = option('port', {
    alias: 'p',
    string: true,
    default: 80,
    describe: "端口号"
})
.option('dir', {
    alias: 'd',
    string: true,
    default: process.cwd(),
    describe: "目录"
})
.option('readonly', {
    alias: 'r',
    string: false,
    default: false,
    describe: "只读模式",
    type: 'boolean'
})
.option('open', {
    alias: 'o',
    string: false,
    default: false,
    describe: "用浏览器打开",
    type: 'boolean'
})


const app = express()
const readonly = argv.readonly
const openByBrowser = argv.open
const rootUrl = argv.dir
let port = argv.port
let portMax = port+3
let http = null


app.use((req,res,next)=>{
    res.header('Access-Control-Allow-Origin','*')
    next()
})
.use(bodyParser.json())
.use('/' , serveStatic( rootUrl , { index : false } ))
.get('/api/*', (req, res) => {
    const reqPath = decodeURI(req.path).replace(/^\/api/, '')
    const nativePath = Path.join( argv.dir , reqPath )

    if( ! fs.existsSync( nativePath ) ){
        return res.status(404).send(req.path + ' not found !')
    }

    res.send({
        readonly : readonly ,
        files : getLinksFromPath(reqPath)
    })
})
.post('/api/*', upload.any() , async (req,res)=>{

    if(readonly){
        res.status(500).send(`只读模式 !`)
        return
    }

    const reqPath = decodeURI(req.path).replace(/^\/api/, '')
    const nativePath = Path.join( argv.dir , reqPath )

    switch (req.body.type) {
        case 'closeServer':
            res.send()
            http.close()
            console.log('exit for client !')
            process.exit(0)
            return
        case 'upload':

            const _file = req.files[0]
            const uploadPath = Path.join(nativePath , req.body.name)

            fs.ensureFileSync(uploadPath)
            fs.writeFileSync(uploadPath, _file.buffer)
            break;
        case 'move':
            const { isCopy , bemoveFileUrls , bemoveFileNames } = req.body
            const bemoveFilePaths = bemoveFileUrls.map((url)=>{
                return Path.join(argv.dir , url)
            })
            const moveToFilePaths = bemoveFileNames.map((name)=>{
                return Path.join(nativePath , name)
            })

            bemoveFilePaths.forEach((bemoveFilePath,index)=>{
                if( isCopy ){
                    fs.copySync(bemoveFilePath, moveToFilePaths[index])
                }
                else{
                    fs.renameSync(bemoveFilePath, moveToFilePaths[index])
                }
            })

            break;
        case 'rename':
            const { oldFileName , newFileName } = req.body
            const oldFilePath = Path.join(nativePath , oldFileName)
            const newFilePath = Path.join(nativePath , newFileName)
            if( fs.existsSync(newFilePath) ){
                return res.status(500).send(`'${ newFilePath }' 已存在 !`)
            }
            fs.renameSync( oldFilePath , newFilePath)
            break;
        case 'remove':
            const filePath = Path.join(nativePath , req.body.filename)
            await trash(filePath)
            break;
        case 'mkdir':
            const dirname = Path.join(nativePath , req.body.dirname)
            fs.mkdirSync(dirname)
            break;
        case 'zip':
            const { files , zipFilename } = req.body
            const zipFilePath = Path.join(nativePath , zipFilename)
            const filePaths = files.map(file=>{
                return Path.join(nativePath , file.name)
            })

            if( fs.existsSync(zipFilePath) ){
                return res.status(500).send(`'${ zipFilePath }' 已存在 !`)
            }

            const output = fs.createWriteStream(zipFilePath)

            const archive = archiver('zip')
            archive.pipe(output)

            filePaths.forEach((filePath,index)=>{
                if( files[index].isFile ){
                    archive.file(filePath,{ name : files[index].name })
                }
                else{
                    archive.directory(filePath,files[index].name)
                }
            })
            await archive.finalize()
            break;

        case 'unzip':
            const { unzipFilename , unzipDirName } = req.body
            const unzipFilePath = Path.join(nativePath , unzipFilename)
            const unzipDirPath = Path.join(nativePath , unzipDirName)
            // console.log( unzipFilePath , unzipDirPath );

            const zip = new StreamZip.async({ file: unzipFilePath })

            if( !fs.existsSync(unzipDirPath) ){
                fs.mkdirSync(unzipDirPath)
            }

            await zip.extract(null, unzipDirPath)
            await zip.close()
            break;
    }

    res.send()
})
.get('*',(req,res)=>{
    res.sendFile( Path.join( __dirname , 'index.html' ) )
})


start()

async function start(){

    for (; port <= portMax; port++) {
        try {

            await new Promise((resolve,reject)=>{
                http = app.listen(port, resolve).on('error',reject)
            })
    
            if(argv.readonly){
                console.log('只读模式 !');
            }

            const portText = port == 80 ? '' : ':'+port
            console.log(rootUrl)
            console.log(`http://localhost:${ port }`)
            console.log(`http://${ address()+portText }`)

            if( openByBrowser ){
                exec(`open ${ `http://localhost:${ port }` }`)
            }

            try {
                const _publicIp = await ( (await publicIp).publicIpv4 )({ timeout : 500 , fallbackUrls : ['https://ifconfig.co/ip'] })
                console.log(`http://${ _publicIp+portText }`)
            }
            catch (error) {
                // console.log(213123123,error);    
            }
            break
        }
        catch (error) {
            if(error.message.includes('address already in use')){
                console.log(`端口号 ${ port } 已被占用 , 尝试使用 ${ port+1 }`);
                await new Promise(resolve=>setTimeout(resolve, 1000))
                continue
            }
            return
        }
    }
}






function getLinksFromPath(reqPath){
    const nativePath = Path.join( argv.dir , reqPath )
    const filenames = fs.readdirSync(nativePath).filter(file=>file[0]!=='.')
    
    if(reqPath!=='/'){
        filenames.unshift('../')
    }

    return filenames.map((name)=>{
        const state = fs.statSync( Path.join(nativePath , name) )
        const isFile = state.isFile()
        const size = state.size

        return {
            isFile,
            size,
            name,
            url : Path.join(reqPath , name).replace(/\\/g, '/')
        }
    })
}