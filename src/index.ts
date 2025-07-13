import { Context, Schema, Session } from 'koishi'
import { ChatContext } from 'koishi-plugin-byd-ai'

import path, { join } from 'path'
import fs from 'fs/promises'

export const name = 'situation-puzzle'

export const inject = {
  required: ["bydAI"],
  optional: ["database"],
}

interface Scene {
  prompt: string
  answer: string
}

type GetSceneMethod = "从配置中" | "从用户输入中" | "从服务器中"

export interface Config {
  scenes: Scene[]
  aiSummary: boolean
  aiResummarizing: number
  aiSuggestion: boolean
  getSceneMethod: GetSceneMethod[]
}

const defaultScenes: Scene[] = [
  {
    prompt: "我是一名大学生，在异地上学。这一天爸爸妈妈给我打电话说他们想我了，让我找个时间回趟家。于是我趁着五一回家了，到家后我打电话给爸爸说我回来了，爸爸回家打开门的一瞬间却疯了。",
    answer: "我患有精神疾病，偶尔会做一些极端的事情，后来开始吃药治疗。上了大学后，我觉得自己已经好了，也怕被大学同学发现和歧视，所以瞒着爸妈偷偷停止服药。这一天爸爸妈妈打电话叫我回家，我也想回家了！就找了最近的假期回去。回到家后我把妈妈杀了，然后剖开了她的肚子取出了子宫，我拿着手里的子宫打电话给爸爸：“爸，我回家了!”"
  },
  {
    prompt: "一位女士去鞋店里买了一双红色高跟鞋，这双高跟鞋预示了她今晚的死亡。",
    answer: "女士是杂技团的一名演员，那天她去买了一双红色的高跟鞋。晚上她穿着这双高跟鞋就去马戏团上班了，她的工作是头顶苹果，配合另外一名男演员表演小李飞刀。结果因为她的高跟鞋，她比平时高出了几公分，没有调整过来的男演员失手将刀插到了她的脑袋上。"
  },
  {
    prompt: "我有两个哥哥，我们三兄弟自小就睡在一张床上。后来有一天二哥因为生病死了，不久后我把大哥也杀了。",
    answer: "我的两个哥哥是双胞胎。从小我们关系就特别好，同睡一张床。大哥睡我左边，二哥睡我右边，十几年了，我已经习惯了这样。可是有一天二哥却因为得了大病死了。我床的右边就这样空了。我很不习惯，突然我想到了！把大哥砍成两半不就好了吗，今天晚上我又睡得好香～"
  },
  {
    prompt: "在儿子去世一周年的祭日上， 我杀死了三个来悼念他的人。",
    answer: "儿子生病去世，他在临终前告诉我，把他的器官捐献给有需要的人，这样他就能以另外的方式继续活在世界上。我同意了。最后儿子身上有三个器官分别捐献给了三个不同的人。在儿子的祭日上，我认出了他们，接受皮肤捐赠的男人，居然满身都是纹身，接受肺部捐赠的小伙，不停地在那吸烟，而接受肝捐赠的居然打电话约朋友晚上出去喝酒。我儿子把生的机会留给他们，但他们竟然这样继续糟践自己。我深深为儿子感到不甘，愤怒不已的我杀了他们三个。"
  },
  {
    prompt: "我杀了人，当警察带走我的时候，我看到了门口的黑猫，它一直在盯着我，这一刻我知道我错了。",
    answer: "我经常能在楼下看到那只黑猫，但由于工作出差的原因，所以我只能投喂它。那天出差回来，我发现阳台上有很多死老鼠，我下意识想到经常闹矛盾的邻居，随后便冲进了他家。伴随着惊呼声和警笛声，我看到了那只黑猫，它也在看着我，嘴里还叼着一只老鼠。"
  },
  {
    prompt: "我发现床头柜上放着一杯蜂蜜水和一块巧克力蛋糕，原本放在床头柜的娃娃却消失不见了。我知道男友再也回不来了。",
    answer: "我的男朋友有暴力倾向，经常对我拳打脚踢，我想离开，却又无能为力。那天沉默寡言的邻居送了我一个娃娃。我知道她对娃娃动了手脚，但我也确认他爱上了我。因此我天天对着娃娃哭诉男友的暴行，连一杯蜂蜜水，一块巧克力蛋糕都是奢求。那天男友动手之后摔门而去。我不知道抱着哇哇哭诉了多久，睡了过去。恍惚中一个陌生的身影伴随着滴嗒声来到我的身边。但我睡得更安心了。(滴嗒声是血滴在地上的声音，邻居砍下了男友的手用来解开我家的指纹锁，他给我带来了一杯蜂蜜水和一块巧克力蛋糕。)"
  },
  {
    prompt: "我的父母都不理我，但我还是很爱他们。",
    answer: "小时候我是个很听话的孩子，爸爸妈妈经常给我好吃的水果，我吃不完。他们就告诉我喜欢的东西一定要放进冰箱，这样可以保鲜，记得那时候他们工作可辛苦了，经常加班到深夜。没睡过一个好觉。于是我耍了个小聪明，在他们的水里下了安眠药。他们睡得可香了，然后我把他们放进冰箱里，从那以后我每天都会对他们说：爸爸妈妈我爱你们。现在我都六十了，他们还是那么年轻。"
  },
  {
    prompt: "一场意外后，妻子便开始把己关在房间里，不肯出来。那天我突然听到她在嚎啕大哭，我急忙冲进房间里，却被眼前的一幕吓傻了。",
    answer: "我很爱我的妻子，有一天我发现妻子怀孕后，就开始精心准备迎接孩子的到来。结果我发现妻子竟然出轨了。为了孩子，我暂时隐忍，但是孩子出生后我发现孩子还不是我的。愤怒之下我精心策划了一场车祸，想让她们通通丧命。谁知妻子竟然活了下来。不过她疯了，她整日把自己关在二楼的婴儿房内，我也不管她，自己只是晚上回来睡个觉，不过经常在房子里闻到一些异味。这一天，我听到了婴儿房里传出嚎啕大哭，我急忙冲进房间。一阵恶臭袭来，我发现妻子怀里抱着的洋娃娃爬满蛆虫，她竟然把死去的孩子缝进了洋娃娃里!她一边抓去娃娃上的蛆虫，一边哭喊着：宝宝别怕，宝宝别怕。"
  },
  {
    prompt: "那天我洗完澡后，说了一句话。家人们听见后都崩溃了。",
    answer: "奶奶生了重病，我和爸爸，叔叔他们回家看望奶奶。当晚奶奶早早地就说身体不舒服，要去睡觉了。我和长辈们在客厅看了一会儿电视后就去洗澡了，洗完澡后我出来跟家人们说，今天的水好奇怪，流出了好多的白毛。爸爸听见后向楼顶的水箱疯狂冲去，只见奶奶的尸体漂浮在水箱里，水里还散落着许多奶奶掉的白头发。"
  },
  {
    prompt: "这两天为了补寒假作业，把我搞得晕头转向，还好在开学那天补完了。今天一早，还没等妈妈起床，我便去学校报道，可到了学校，我却疯了",
    answer: "我今年高三，来自单亲家庭。到了最后半年的冲刺阶段，妈妈却突然生了大病。还好现在是寒假，我可以照顾她。明天就要开学了。把妈妈哄睡后，我继续补作业。不知不觉天亮了，为了让妈妈多睡会儿，我蹑手蹑脚地出了门。到了学校打开寒假作业后，我在里面发现了一张纸。仔细一看竟然是妈妈写的遗书，遗书里妈妈说到，即使没有她我也能照顾好自己。但如果只剩我一个人，如果考上好大学又有什么用呢?"
  }
]

export const Config: Schema<Config> = Schema.object({
  aiSummary: Schema.boolean().default(false).description("是否开启AI总结功能"),
  aiResummarizing: Schema.number().default(0).description("AI对现有总结进行整理所需的次数（为0时关闭该功能）（目前该功能处于实验性，不建议开启，若开启，可能导致大量token消耗）").experimental(),
  aiSuggestion: Schema.boolean().default(false).description("是否开启AI建议功能"),
  getSceneMethod: Schema.array(Schema.union(["从配置中", "从用户输入中", "从服务器中"])).default(["从配置中", "从用户输入中"]).role("checkbox").description("获取场景的方式"),
  scenes: Schema.array(Schema.object({
    prompt: Schema.string().role('textarea').description("汤面"),
    answer: Schema.string().role('textarea').description("汤底")
  })).description("场景").default(defaultScenes),
})

interface Talk {
  platform: string
  channelId: string
  playerId: string
  ctx: ChatContext
  players: { id: number, name: string }[]
  talking: boolean
  sceneId: string
  scene: Scene
  summary: string[]
  info: string[]
}

interface SceneWithId {
  id: string
  scene: Scene
}

interface LocalData {
  channelAlreadyRandomScene: {
    [channelId: string]: string[]
  }
  inputScenes: SceneWithId[]
  configScenes: SceneWithId[]
}

function generateId(getSceneMethod: GetSceneMethod, length: number = 8) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let id = ''
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  let prefix = getSceneMethod === '从配置中' ? "config-" : getSceneMethod === '从用户输入中' ? 'input-' : 'server-'
  return prefix + id
}

function parseSceneType(id: string): GetSceneMethod {
  if (id.startsWith("config-")) return '从配置中'
  else if (id.startsWith("input-")) return '从用户输入中'
  else if (id.startsWith("server-")) return '从服务器中'
}

async function getUserId(ctx: Context, session: Session) {
  const userId = (await ctx.database.getUser(session.platform, session.userId)).id
  return userId
}

function createTalk(c: Context, s: Session, cc: ChatContext, scene: Scene, sceneId: string): Talk {
  return {
    platform: s.platform,
    channelId: s.channelId,
    playerId: s.userId,
    ctx: cc,
    sceneId,
    players: [],
    talking: false,
    scene,
    summary: [],
    info: []
  }
}

function getCueWord(scene: Scene) {
  return `我们现在在玩海龟汤，你是海龟汤的主持人。
  在游玩过程中，用户会向你提出问题，你只能回答*"yes"*与*"no"*，当用户提出的问题一半符合一半不符合等半对半错的问题，你需要回答*"or"*。当用户的问题无法用是或不是回答时，你只需要回复*"invalid"*即可。
  当用户尝试猜汤底时，如果用户猜错汤底，你需要回复*"incorrect_scene"*，当用户正确猜出汤底后，你需要回复*"correct_scene"*。
  ## 以下为汤面
  ${scene.prompt}
  ---
  ## 以下为汤底
  ${scene.answer}
  `
}

type ResponseType = "yes" | "no" | "invalid" | "incorrect_scene" | "correct_scene" | "or"

function parseResponse(res: string): ResponseType | "invalid_response" {
  if (res === "no") return "no"
  else if (res === "yes") return "yes"
  else if (res === "invalid") return "invalid"
  else if (res === "incorrect_scene") return "incorrect_scene"
  else if (res === "correct_scene") return "correct_scene"
  else if (res === "or") return "or"
  else return "invalid_response"
}

async function readOrCreateFile(path: string, defaultValue: string = '') {
  try {
    // 尝试访问文件
    await fs.access(path, fs.constants.F_OK)
    // 文件存在则读取
    return await fs.readFile(path, 'utf8')
  } catch {
    // 文件不存在则创建
    await fs.writeFile(path, defaultValue)
    return defaultValue
  }
}

export function apply(ctx: Context, cfg: Config) {
  const LOCAL_DATA_DIR_PATH = path.join(ctx.baseDir, "data", "ac", "situation-puzzle")
  const LOCAL_DATA_FILE_PATH = path.join(LOCAL_DATA_DIR_PATH, "data.json")

  const compareScene = (first: Scene, second: Scene) => first.prompt === second.prompt ? first.answer === second.answer ? true : false : false

  const randomScene = async (channelId: string) => {
    let sceneList: SceneWithId[] = []
    localData.channelAlreadyRandomScene[channelId] || (localData.channelAlreadyRandomScene[channelId] = [])

    if (cfg.getSceneMethod.includes("从配置中")) sceneList.push(...localData.configScenes)
    if (cfg.getSceneMethod.includes("从用户输入中")) sceneList.push(...localData.inputScenes)
    if (cfg.getSceneMethod.includes("从服务器中")) {
      let scenes: SceneWithId[]
      try {
        const abortController = new AbortController()
        ctx.setTimeout(() => abortController.abort(), 5 * 1000)
        scenes = JSON.parse(await ctx.http.get("https://public.ac-official.net/v1/api/situation-puzzle/get-scenes", { signal: abortController.signal }))
      } catch (e) {
        ctx.logger.error(e)
        scenes = !cfg.getSceneMethod.includes("从配置中") && !cfg.getSceneMethod.includes("从用户输入中") ? [...localData.configScenes, ...localData.inputScenes] : []
      }
      sceneList.push(...scenes)
    }

    if (sceneList.every(s => localData.channelAlreadyRandomScene[channelId].includes(s.id))) localData.channelAlreadyRandomScene[channelId] = []
    sceneList = sceneList.filter(s => !localData.channelAlreadyRandomScene[channelId].includes(s.id))

    const index = Math.floor(Math.random() * sceneList.length)
    return sceneList[index]
  }


  let talks: Talk[] = []
  let localData: LocalData

  const saveLocalData = async () => await fs.writeFile(LOCAL_DATA_FILE_PATH, JSON.stringify(localData, null, 2))

  ctx.on('ready', async () => {
    await fs.mkdir(LOCAL_DATA_DIR_PATH, { recursive: true })
    const defaultData: LocalData = {
      channelAlreadyRandomScene: {},
      inputScenes: [],
      configScenes: []
    }
    const str = await readOrCreateFile(LOCAL_DATA_FILE_PATH, JSON.stringify(defaultData, null, 2))
    localData = JSON.parse(str)

    const remainingConfigScene = localData.configScenes.length === 0 ? cfg.scenes : cfg.scenes.filter(s => !localData.configScenes.map(s => s.scene).some(cs => compareScene(cs, s)))
    for (const scene of remainingConfigScene) {
      localData.configScenes.push({
        id: generateId("从配置中"),
        scene
      })
    }

    const redundantConfigScene = localData.configScenes.map(s => s.scene).filter(s => !cfg.scenes.some(cs => compareScene(cs, s)))
    localData.configScenes = localData.configScenes.filter(s => !redundantConfigScene.some(rcs => compareScene(rcs, s.scene)))

    await saveLocalData()

    ctx.setInterval(async () => {
      await saveLocalData()
    }, 1 * 60 * 60 * 1000)
  })

  ctx.on('dispose', async () => {
    await saveLocalData()
  })

  ctx.command("开始海龟汤")
  .action(async ({session}) => {
    const scene = await randomScene(session.channelId)
    const chatCtx = ctx.bydAI.createChatContext()
    chatCtx.addSystemMessage({
      role: "system",
      content: getCueWord(scene.scene)
    })
    const talk = createTalk(ctx, session, chatCtx, scene.scene, scene.id)
    talk.players.push({
      name: session.username,
      id: await getUserId(ctx, session)
    })
    talks.push(talk)
    return scene.scene.prompt
  })

  ctx.command("talk <...nsg>")
  .action(async ({session}, ...msg) => {
    const message = msg.join(" ")
    const talk = talks.find(t => t.platform === session.platform && t.channelId === session.channelId)
    if (!talk) return "该群组内还没有对话！"
    if (talk.talking) return "AI还未对上一个对话做出答复！"
    talk.talking = true
    talk.ctx.addMessage({
      role: 'user',
      content: message
    })
    const res = await talk.ctx.send({})
    const resType = parseResponse(res.content)
    let result: string
    let info: string
    switch (resType) {
      case "invalid_response": {
        result = "AI未给出正确答复：\n" + res.content
        break
      }
      case 'yes': {
        result = "对"
        info = message + "\n正确"
        break
      }
      case "no": {
        result = "不对"
        info = message + "\n错误"
        break
      }
      case "or": {
        result = "半对半错"
        info = message + "\n半对半错"
        break
      }
      case "invalid": {
        result = "该问题无效！"
        break
      }
      case "incorrect_scene": {
        result = "猜测错误！"
        break
      }
      case "correct_scene": {
        await session.send("猜测正确！")
        result = talk.scene.answer
        localData.channelAlreadyRandomScene[session.channelId].push(talk.sceneId)
        break
      }
    }
    if (info && cfg.aiSuggestion && !cfg.aiSummary) {
      talk.info.push(info)
    }
    if (info && cfg.aiSummary) {
      const chatCtx = ctx.bydAI.createChatContext()
      chatCtx.addSystemMessage({
        role: "system",
        content: `我们在玩海龟汤的游戏，我们每次提问后会将提出的问题以及该问题是否正确发送给你，你需要帮我们总结出这个问题的有用信息
        你的总结不允许使用markdown
        你的总结需要尽量简洁，要保证总结只有一句话
        你的总结必须包含该问题的有用信息，例如：“这个故事有人死吗\n正确”你需要总结出这个问题的有用信息“故事中有人死亡。”`
      })
      chatCtx.addMessage({
        role: "user",
        content: info
      })
      const res = await chatCtx.send({})
      talk.summary.push(res.content)
      if (talk.summary.length >= cfg.aiResummarizing && cfg.aiResummarizing !== 0) {
        const chatCtx = ctx.bydAI.createChatContext()
        chatCtx.addSystemMessage({
          role: "system",
          content: `我们正在玩海龟汤的游戏，现在我们有一些结论，请你整理这些结论
          你整理的结论不允许使用markdown
          你的总结需要尽量简洁，要保证每条结论只有一句话
          你的总结需要包含所有的有效结论
          ## 例子
          ### input
          妻子患有精神疾病与意外导致第三人死亡有关。
          故事中没有第四个人。
          故事中的意外是主角故意造成的。
          妻子确实出轨了。
          妻子确实有出轨行为。
          ### output
          妻子患有精神疾病与意外导致第三人死亡有关。
          故事中没有第四个人。
          故事中的意外是主角故意造成的。
          妻子存在出轨行为。
          `
        })
        chatCtx.addMessage({
          role: "user",
          content: talk.summary.join("\n")
        })
        const res = await chatCtx.send({})
        talk.summary = res.content.split("\n")
      }
    }
    talk.talking = false
    return result
  })

  if (cfg.aiSummary) {
    ctx.command("查看总结")
    .action(({session}) => {
      const talk = talks.find(t => t.platform === session.platform && t.channelId === session.channelId)
      if (!talk) return "该群组内还没有对话！"
      return talk.summary.join("\n")
    })
  }

  if (cfg.aiSuggestion) {
    ctx.command("AI提示")
    .action(async ({session}) => {
      const talk = talks.find(t => t.platform === session.platform && t.channelId === session.channelId)
      if (!talk) return "该群组内还没有对话！"
      let info: string
      if (cfg.aiSummary) {
        info = talk.summary.join("\n")
      } else {
        info = talk.info.join("\n---\n")
      }
      const chatCtx = ctx.bydAI.createChatContext()
      chatCtx.addSystemMessage({
        role: 'system',
        content: `你现在是一名专业的海龟汤推理人，你推理成功了无数场海龟汤，现在，有一名用户需要你来帮助他分析
        禁止使用markdown，你的回答要简洁并且表现出你的专业性，你可以适当使用括号并在括号内加入你的动作和神情来让你看上去是一个专业的海龟汤推理人而不是AI
        你需要根据用户给出的信息为用户指明用户该提出的下一个问题，或者当线索齐全时你也可以直接对汤底进行猜测`
      })
      chatCtx.addMessage({
        role: "user",
        content: `以下为汤面：
        ${talk.scene.prompt}
        ---
        以下为目前拥有的信息：
        ${info}`
      })
      const res = await chatCtx.send({})
      return res.content
    })
  }

  ctx.command("查看汤面")
  .action(({session}) => {
    const talk = talks.find(t => t.platform === session.platform && t.channelId === session.channelId)
    if (!talk) return "该群组内还没有对话！"
    return talk.scene.prompt
  })

  ctx.command("finishtalk")
  .action(({session}) => {
    const talk = talks.find(t => t.platform === session.platform && t.channelId === session.channelId)
    if (!talk) return "该群组内还没有对话！"
    talks = talks.filter(t => t !== talk)
    return "你已结束该对话"
  })

  if (cfg.getSceneMethod.includes("从用户输入中")) {
    ctx.command("登记场景")
    .action(async ({session}) => {
      const awaitUserInput = (): Promise<string> => {
        return new Promise(resolve => {
          const cancelListener = ctx.on("message", s => {
            if (s.platform === session.platform && s.channelId === session.channelId && s.userId === session.userId) {
              cancelListener()
              resolve(s.content)
            }
          })
        })
      }

      await session.send("请输入汤面")
      const prompt = await awaitUserInput()
      await session.send("请输入汤底")
      const answer = await awaitUserInput()

      localData.inputScenes.push({
        id: generateId("从用户输入中"),
        scene: {
          prompt,
          answer
        }
      })
    })
  }
}
