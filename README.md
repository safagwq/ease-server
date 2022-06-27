# web-ease-server
简易的web api服务

![命令行界面](images/image2.jpg)
![浏览器操作界面](images/image1.jpg)

# 安装
```
git clone https://github.com/safagwq/safa-ease-server.git
cd safa-ease-server
yarn
yarn build
```

# 使用之前
您需要使用
```
alias ease-server="~/git/safa-ease-server/ease-server"
```
或者
```
ln -s /Users/safa/git/safa-ease-server/ease-server /usr/local/bin/ease-server
```
等命令将命令设置为全局模式 , 目前暂未提供npm 全局安装方式 .

也可以直接在 safa-ease-server 这个目录里运行 
```
./ease-server -d "目录位置"
```


# 静态服务器
进入任何目录 , ease-server, 会将这个目录视为静态服务器的根目录 , 默认运行3000端口

```
ease-server
```
或者
```
ease-server -p 8080
```
或者
```
ease-server -d ~/Downloads
```
