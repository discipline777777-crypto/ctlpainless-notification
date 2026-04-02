import { useState, useCallback, useMemo } from 'react';
import { FileText, Users, Building2, Upload, CheckCircle2, AlertCircle, Copy, Download, File, Loader2 } from 'lucide-react';

// @ts-ignore - mammoth 库没有类型定义但支持 ESM
import mammoth from 'mammoth';
// @ts-ignore - pdfjs-dist 动态加载
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker 配置 - 使用 CDN
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Department {
  name: string;
  keywords: string[];
  receivers?: string[];
  category?: string;
  groupKey: string; // 用于分类关键词匹配
}

interface ProcessingResult {
  fileName: string;
  departmentsFound: string[];
  receiversToAdd: string[];
  totalReceivers: number;
  rawText?: string;
}

// 分类关键词定义（用于识别通知中的分类词）
// 注意：只有包含"各"字的才是分类词，表示全部匹配
const CATEGORY_PATTERNS = {
  '各街道': ['各街道', '各街道党工委', '各街道办事处'],
  '各开发区': ['各开发区', '开发区党工委', '开发区管委会'],
  '三大园区': ['三大园区', '三大园区办'],
  '区委': ['区委各部委办局', '区委部委办局', '区委各部委'],
  '区各委办局': ['区各委办局', '区各委办', '各委办局'],
  '区各群团': ['区各群团', '区各群团组织', '各群团组织', '群团组织'],
  '区各直属': ['区各直属单位', '区各直属', '各直属单位'],
  '市驻区': ['市驻区', '市驻区各单位', '驻区各单位', '驻区各'],
  '国企': ['区各直属国企', '区各直属国有企业', '三大国企', '三家国企', '三大集团', '国企集团', '国有企业'],
};

// 崇川区完整部门通讯录（含简称和分组标识）
// 微信关键词格式：单位名称直接加"收文"（如"城东街道收文"）
const allDepartments: Department[] = [
  // ===== 各街道（16个）=====
  { name: "城东街道", keywords: ["城东街道", "城东"], category: "街道", groupKey: "各街道" },
  { name: "陈桥街道", keywords: ["陈桥街道", "陈桥"], category: "街道", groupKey: "各街道" },
  { name: "和平桥街道", keywords: ["和平桥街道", "和平桥"], category: "街道", groupKey: "各街道" },
  { name: "虹桥街道", keywords: ["虹桥街道", "虹桥"], category: "街道", groupKey: "各街道" },
  { name: "狼山镇街道", keywords: ["狼山镇街道", "狼山街道", "狼山"], category: "街道", groupKey: "各街道" },
  { name: "秦灶街道", keywords: ["秦灶街道", "秦灶"], category: "街道", groupKey: "各街道" },
  { name: "任港街道", keywords: ["任港街道", "任港"], category: "街道", groupKey: "各街道" },
  { name: "天生港镇街道", keywords: ["天生港镇街道", "天生港镇", "天生港"], category: "街道", groupKey: "各街道" },
  { name: "唐闸镇街道", keywords: ["唐闸镇街道", "唐闸镇", "唐闸"], category: "街道", groupKey: "各街道" },
  { name: "文峰街道", keywords: ["文峰街道", "文峰"], category: "街道", groupKey: "各街道" },
  { name: "新城桥街道", keywords: ["新城桥街道", "新城桥"], category: "街道", groupKey: "各街道" },
  { name: "幸福街道", keywords: ["幸福街道", "幸福"], category: "街道", groupKey: "各街道" },
  { name: "学田街道", keywords: ["学田街道", "学田"], category: "街道", groupKey: "各街道" },
  { name: "永兴街道", keywords: ["永兴街道", "永兴"], category: "街道", groupKey: "各街道" },
  { name: "钟秀街道", keywords: ["钟秀街道", "钟秀"], category: "街道", groupKey: "各街道" },
  { name: "观音山街道", keywords: ["观音山街道", "观音山"], category: "街道", groupKey: "各街道" },

  // ===== 各开发区（2个）=====
  { name: "崇川开发区", keywords: ["崇川开发区", "崇川经济开发区", "崇开"], category: "开发区", groupKey: "各开发区" },
  { name: "港闸开发区", keywords: ["港闸开发区", "港闸经济开发区", "港开"], category: "开发区", groupKey: "各开发区" },

  // ===== 三大园区（3个）=====
  { name: "市北高新区", keywords: ["市北高新区", "市北高新", "市北"], category: "开发区", groupKey: "三大园区" },

  // ===== 区委、人大、政协办（3个）=====
  { name: "区委办", keywords: ["区委办", "区委办公室"], category: "区委", groupKey: "区委" },
  { name: "人大办", keywords: ["人大办", "人大办公室"], category: "人大", groupKey: "区委" },
  { name: "政协办", keywords: ["政协办", "政协办公室"], category: "政协", groupKey: "区委" },

  // ===== 区委各部委办局（12个）=====
  { name: "组织部", keywords: ["组织部"], category: "区委", groupKey: "区委" },
  { name: "宣传部", keywords: ["宣传部", "文明办"], category: "区委", groupKey: "区委" },
  { name: "统战部", keywords: ["统战部", "台办", "民宗局", "侨办"], category: "区委", groupKey: "区委" },
  { name: "社工部", keywords: ["社工部", "社会工作部"], category: "区委", groupKey: "区委" },
  { name: "网信办", keywords: ["网信办"], category: "区委", groupKey: "区委" },
  { name: "编办", keywords: ["编办"], category: "区委", groupKey: "区委" },
  { name: "机关工委", keywords: ["机关工委"], category: "区委", groupKey: "区委" },
  { name: "巡察办", keywords: ["巡察办"], category: "区委", groupKey: "区委" },
  { name: "老干部局", keywords: ["老干部局", "区委老干部局"], category: "区委", groupKey: "区委" },
  { name: "人武部", keywords: ["人武部"], category: "区委", groupKey: "区委" },
  { name: "政法委", keywords: ["政法委"], category: "区委", groupKey: "区委" },
  { name: "纪委监委", keywords: ["纪委监委", "纪委", "监委"], category: "区委", groupKey: "区委" },

  // ===== 区各委办局（25个）=====
  { name: "发改委", keywords: ["发改委", "发改"], category: "委办局", groupKey: "区各委办局" },
  { name: "工信局", keywords: ["工信局", "工信"], category: "委办局", groupKey: "区各委办局" },
  { name: "商务局", keywords: ["商务局"], category: "委办局", groupKey: "区各委办局" },
  { name: "科技局", keywords: ["科技局", "科技"], category: "委办局", groupKey: "区各委办局" },
  { name: "财政局", keywords: ["财政局", "财政"], category: "委办局", groupKey: "区各委办局" },
  { name: "人社局", keywords: ["人社局", "人社"], category: "委办局", groupKey: "区各委办局" },
  { name: "文旅局", keywords: ["文旅局", "文旅"], category: "委办局", groupKey: "区各委办局" },
  { name: "审计局", keywords: ["审计局"], category: "委办局", groupKey: "区各委办局" },
  { name: "国资办", keywords: ["国资办"], category: "委办局", groupKey: "区各委办局" },
  { name: "数据局", keywords: ["数据局"], category: "委办局", groupKey: "区各委办局" },
  { name: "统计局", keywords: ["统计局"], category: "委办局", groupKey: "区各委办局" },
  { name: "投促局", keywords: ["投促局", "招商局", "招商", "投促"], category: "委办局", groupKey: "区各委办局" },
  { name: "税务局", keywords: ["税务局"], category: "委办局", groupKey: "区各委办局" },
  { name: "住建局", keywords: ["住建局"], category: "委办局", groupKey: "区各委办局" },
  { name: "市政局", keywords: ["市政局"], category: "委办局", groupKey: "区各委办局" },
  { name: "城管局", keywords: ["城管局"], category: "委办局", groupKey: "区各委办局" },
  { name: "资规分局", keywords: ["资规分局", "自然资源与规划分局", "资规"], category: "委办局", groupKey: "区各委办局" },
  { name: "教体局", keywords: ["教体局", "教体"], category: "委办局", groupKey: "区各委办局" },
  { name: "民政局", keywords: ["民政局"], category: "委办局", groupKey: "区各委办局" },
  { name: "司法局", keywords: ["司法局"], category: "委办局", groupKey: "区各委办局" },
  { name: "农水局", keywords: ["农水局"], category: "委办局", groupKey: "区各委办局" },
  { name: "卫健委", keywords: ["卫健委"], category: "委办局", groupKey: "区各委办局" },
  { name: "退役军人事务局", keywords: ["退役军人事务局"], category: "委办局", groupKey: "区各委办局" },
  { name: "应急管理局", keywords: ["应急管理局", "应急局", "应急"], category: "委办局", groupKey: "区各委办局" },
  { name: "市场监管局", keywords: ["市场监管局", "市监局"], category: "委办局", groupKey: "区各委办局" },
  { name: "信访局", keywords: ["信访局"], category: "委办局", groupKey: "区各委办局" },

  // ===== 区各群团组织（11个）=====
  { name: "总工会", keywords: ["总工会"], category: "群团", groupKey: "区各群团" },
  { name: "团委", keywords: ["团委"], category: "群团", groupKey: "区各群团" },
  { name: "妇联", keywords: ["妇联"], category: "群团", groupKey: "区各群团" },
  { name: "科协", keywords: ["科协"], category: "群团", groupKey: "区各群团" },
  { name: "残联", keywords: ["残联"], category: "群团", groupKey: "区各群团" },
  { name: "工商联", keywords: ["工商联"], category: "群团", groupKey: "区各群团" },
  { name: "文联", keywords: ["文联"], category: "群团", groupKey: "区各群团" },
  { name: "社科联", keywords: ["社科联"], category: "群团", groupKey: "区各群团" },
  { name: "侨联", keywords: ["侨联"], category: "群团", groupKey: "区各群团" },
  { name: "红会", keywords: ["红会", "红十字会"], category: "群团", groupKey: "区各群团" },
  { name: "关工委", keywords: ["关工委", "关心下一代工作委员会"], category: "群团", groupKey: "区各群团" },

  // ===== 区各直属单位（8个）=====
  { name: "濠河办", keywords: ["濠河办", "濠河管理办", "濠河"], category: "直属单位", groupKey: "区各直属" },
  { name: "党校", keywords: ["党校", "区委党校"], category: "直属单位", groupKey: "区各直属" },
  { name: "档案馆", keywords: ["档案馆"], category: "直属单位", groupKey: "区各直属" },
  { name: "融媒体中心", keywords: ["融媒体中心"], category: "直属单位", groupKey: "区各直属" },
  { name: "指挥中心", keywords: ["指挥中心", "区域社会治理现代化指挥中心", "社会治理现代化指挥中心"], category: "直属单位", groupKey: "区各直属" },
  { name: "机关事务服务中心", keywords: ["机关事务服务中心", "机关事务局"], category: "直属单位", groupKey: "区各直属" },
  { name: "环卫处", keywords: ["环卫处"], category: "直属单位", groupKey: "区各直属" },
  { name: "供销总社", keywords: ["供销总社"], category: "直属单位", groupKey: "区各直属" },

  // ===== 市驻区各单位（3个）=====
  { name: "公安分局", keywords: ["公安分局", "公安崇川分局", "公安"], category: "市驻区", groupKey: "市驻区" },
  { name: "生态环境局", keywords: ["生态环境局", "生态局", "生态"], category: "市驻区", groupKey: "市驻区" },
  { name: "消防救援局", keywords: ["消防救援局", "消防大队", "消防"], category: "市驻区", groupKey: "市驻区" },

  // ===== 三大国企集团（3个）=====
  { name: "崇川国投", keywords: ["崇川国投", "崇川国控", "崇川国控集团", "国控"], category: "国企", groupKey: "国企" },
  { name: "崇川商旅", keywords: ["崇川商旅", "崇川商旅集团", "商旅"], category: "国企", groupKey: "国企" },
  { name: "崇川产发", keywords: ["崇川产发", "崇川产发集团", "产发"], category: "国企", groupKey: "国企" },

  // ===== 临时机构 ======
  { name: "寺街西南营专班", keywords: ["寺街西南营专班", "寺街西南营"], category: "临时机构", groupKey: "" },

  // ===== 其他单位 ======
  { name: "法院", keywords: ["法院"], category: "其他", groupKey: "" },
  { name: "检察院", keywords: ["检察院"], category: "其他", groupKey: "" },
  { name: "更新中心", keywords: ["更新中心", "城市更新中心", "城市更新服务中心"], category: "其他", groupKey: "" },
  { name: "城建中心", keywords: ["城建中心"], category: "其他", groupKey: "" },
  { name: "代建中心", keywords: ["代建中心"], category: "其他", groupKey: "" },
];

// 区领导秘书名单（微信关键词格式：姓名+收文）
const LEADERSHIP_SECRETARIES = [
  "吴佳华", "李建波", "胡永宁", "周卫平", "徐炜", "周勇", "陆志明", "唐金亮", "高翔"
];

// 文档解析函数
async function parseDocument(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  const fileSize = file.size;

  if (fileSize > 10 * 1024 * 1024) {
    console.warn('文件较大，解析可能需要较长时间');
  }

  try {
    // DOCX 格式
    if (fileName.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (!result.value || result.value.trim() === '') {
        throw new Error('文档内容为空，可能文件已损坏');
      }
      return result.value;
    }

    // PDF 格式
    if (fileName.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      // @ts-ignore
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer
      }).promise;
      const textParts: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        textParts.push(pageText);
      }

      const fullText = textParts.join('\n');
      if (!fullText.trim()) {
        throw new Error('PDF文档可能为扫描件或图片型PDF，无法提取文字');
      }
      return fullText;
    }

    // OFD 格式
    if (fileName.endsWith('.ofd')) {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let text = '';

      try {
        const decoder = new TextDecoder('utf-8');
        text = decoder.decode(uint8Array);
        text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      } catch {
        try {
          const decoder = new TextDecoder('gbk');
          text = decoder.decode(uint8Array);
          text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        } catch {
          throw new Error('OFD格式暂不支持浏览器直接解析，请将文件另存为PDF或Word格式后重试');
        }
      }

      if (!text || text.length < 10) {
        throw new Error('OFD文档内容无法识别，建议转换为PDF格式后重试');
      }
      return text;
    }

    // TXT 格式
    if (fileName.endsWith('.txt')) {
      const text = await file.text();
      if (!text.trim()) {
        throw new Error('文本文件内容为空');
      }
      return text;
    }

    throw new Error(`不支持的文件格式: ${file.name}。请上传 .docx, .pdf, .txt 或 .ofd 格式的文件`);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('文档解析失败，请确认文件格式正确');
  }
}

// 识别文档中的部门和秘书
function identifyDepartments(content: string, departments: Department[]): {
  found: string[],
  matchedDetails: Array<{ dept: string, matched: string, category?: string }>
} {
  const found: string[] = [];
  const matchedDetails: Array<{ dept: string, matched: string, category?: string }> = [];
  const matchedByGroup = new Set<string>(); // 记录通过分类关键词匹配的部门

  // 预处理：去除文本中所有空格（包括中间空格），避免PDF转文本时产生的空格问题
  const contentNoSpace = content.replace(/\s+/g, '');

  // 第一步：检测分类关键词（使用无空格版本）
  Object.entries(CATEGORY_PATTERNS).forEach(([groupKey, patterns]) => {
    if (patterns.some(pattern => contentNoSpace.includes(pattern.replace(/\s+/g, '')))) {
      // 找到分类关键词，添加该组所有部门
      departments.forEach(dept => {
        if (dept.groupKey === groupKey && !matchedByGroup.has(dept.name)) {
          matchedByGroup.add(dept.name);
          if (!found.includes(dept.name)) {
            found.push(dept.name);
            matchedDetails.push({
              dept: dept.name,
              matched: `分类词: "${patterns.find(p => contentNoSpace.includes(p.replace(/\s+/g, '')))}"`,
              category: dept.category
            });
          }
        }
      });
    }
  });

  // 第二步：精确匹配部门关键词
  // 按关键词长度降序排列，避免短关键词优先匹配
  const sortedDepts = [...departments].sort((a, b) => {
    const maxLenA = Math.max(...a.keywords.map(k => k.length));
    const maxLenB = Math.max(...b.keywords.map(k => k.length));
    return maxLenB - maxLenA;
  });

  sortedDepts.forEach(dept => {
    for (const keyword of dept.keywords) {
      // 使用无空格版本进行匹配
      if (contentNoSpace.includes(keyword)) {
        if (!found.includes(dept.name)) {
          found.push(dept.name);
          matchedDetails.push({
            dept: dept.name,
            matched: `"${keyword}"`,
            category: dept.category
          });
        }
        break;
      }
    }
  });

  // 第三步：特殊处理 - 三大园区（包含崇开、港开、市北）
  if (contentNoSpace.includes('三大园区')) {
    ['崇川开发区', '港闸开发区', '市北高新区'].forEach(name => {
      if (!found.includes(name)) {
        found.push(name);
        const dept = departments.find(d => d.name === name);
        matchedDetails.push({
          dept: name,
          matched: '三大园区',
          category: dept?.category
        });
      }
    });
  }

  // 第四步：识别区领导秘书（人名）
  LEADERSHIP_SECRETARIES.forEach(secretary => {
    if (contentNoSpace.includes(secretary)) {
      if (!found.includes(secretary)) {
        found.push(secretary);
        matchedDetails.push({
          dept: secretary,
          matched: `"${secretary}"`,
          category: '领导秘书'
        });
      }
    }
  });

  return { found, matchedDetails };
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'process' | 'config'>('process');
  const [matchedDetails, setMatchedDetails] = useState<Array<{ dept: string, matched: string, category?: string }>>([]);

  const departments = useMemo(() => allDepartments, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setResult(null);
    setError(null);
    setProcessingStep('正在解析文档...');
    setIsProcessing(true);

    try {
      const content = await parseDocument(uploadedFile);
      setFileContent(content);
      setRawText(content);
      setProcessingStep('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '文档解析失败';
      setError(errorMessage);
      setFile(null);
      setFileContent('');
      setRawText('');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handlePasteContent = useCallback((content: string) => {
    setFileContent(content);
    setRawText(content);
    setFile(null);
    setResult(null);
    setError(null);
  }, []);

  const handleProcess = useCallback(async () => {
    if (!fileContent) {
      setError('请先上传文档或粘贴内容');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessingStep('正在识别部门...');

    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      const { found, matchedDetails: details } = identifyDepartments(fileContent, departments);

      const receiversToAdd: string[] = found.map(dept => `${dept}收文员`);

      const processingResult: ProcessingResult = {
        fileName: file?.name || '粘贴内容',
        departmentsFound: found.sort(),
        receiversToAdd,
        totalReceivers: found.length,
        rawText: fileContent
      };

      setResult(processingResult);
      setMatchedDetails(details);
      setProcessingStep('');
    } catch (err) {
      setError('处理文档时发生错误');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }, [fileContent, file, departments]);

  const copyReceivers = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result.receiversToAdd.join('\n'));
    }
  }, [result]);

  const downloadResult = useCallback(() => {
    if (result) {
      const data = {
        ...result,
        matchedDetails,
        processedAt: new Date().toISOString(),
        instruction: '请在企业微信通讯录中搜索对应的收文人员'
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `部门识别结果_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [result, matchedDetails]);

  const copyMatchedDepartments = useCallback(() => {
    if (matchedDetails.length > 0) {
      const text = matchedDetails.map(m => `${m.dept} ← "${m.matched}"`).join('\n');
      navigator.clipboard.writeText(text);
    }
  }, [matchedDetails]);

  // 生成微信搜索关键词（单位名称+收文格式，空格分隔）
  // 按用户清单格式：城东街道收文、崇川开发区收文、崇川国投收文
  const wechatSearchKeywords = useMemo(() => {
    if (!result || result.departmentsFound.length === 0) return '';

    const keywords = result.departmentsFound.map(dept => `${dept}收文`);
    return keywords.join(' ');
  }, [result]);

  const copyWechatKeywords = useCallback(() => {
    if (wechatSearchKeywords) {
      navigator.clipboard.writeText(wechatSearchKeywords);
    }
  }, [wechatSearchKeywords]);

  // 按分类分组显示部门
  const groupedDepartments = useMemo(() => {
    const groups: Record<string, Department[]> = {};
    departments.forEach(dept => {
      const cat = dept.category || '其他';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(dept);
    });
    return groups;
  }, [departments]);

  const categoryNames: Record<string, string> = {
    '开发区': '开发区/高新区',
    '街道': '各街道',
    '区委': '区委各部委办局',
    '委办局': '区各直属单位',
    '市驻区': '市驻区各单位',
    '国企': '三大国企集团',
    '群团': '区各群团组织',
    '其他': '其他单位'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-blue-800/30">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">无痛发文</h1>
              <p className="text-sm text-blue-300">自动识别参会部门 · 一键匹配收文人员</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="flex gap-2 border-b border-blue-800/30">
          <button
            onClick={() => setActiveTab('process')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'process'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            文档处理
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'config'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            部门配置
          </button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {activeTab === 'process' ? (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-blue-800/30">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-400" />
                  上传通知文档
                </h2>

                <div className="mb-4">
                  <label className="block w-full border-2 border-dashed border-blue-700/50 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors">
                    <input
                      type="file"
                      accept=".txt,.docx,.doc,.pdf,.ofd"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isProcessing}
                    />
                    {file ? (
                      <div className="text-blue-400">
                        <File className="w-10 h-10 mx-auto mb-2" />
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-slate-400 mt-1">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                        {processingStep && (
                          <p className="text-sm text-blue-300 mt-2 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {processingStep}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-400">
                        <Upload className="w-10 h-10 mx-auto mb-2" />
                        <p>点击或拖拽文件到此处</p>
                        <p className="text-sm mt-1">支持 .docx, .pdf, .txt, .ofd 格式</p>
                      </div>
                    )}
                  </label>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-blue-800/30"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-slate-800 px-3 text-sm text-slate-400">或粘贴内容</span>
                  </div>
                </div>

                <div className="mt-4">
                  <textarea
                    value={fileContent}
                    onChange={(e) => handlePasteContent(e.target.value)}
                    placeholder="在此粘贴通知内容，或上传文件..."
                    className="w-full h-48 bg-slate-900/50 border border-blue-800/30 rounded-lg p-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <button
                  onClick={handleProcess}
                  disabled={!fileContent || isProcessing}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {processingStep || '处理中...'}
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      开始处理
                    </>
                  )}
                </button>

                {error && (
                  <div className="mt-4 flex items-start gap-2 text-red-400 bg-red-900/20 rounded-lg p-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                {rawText && !error && (
                  <details className="mt-4">
                    <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300">
                      查看原始文本 ({rawText.length} 字符)
                    </summary>
                    <div className="mt-2 p-3 bg-slate-900/50 rounded-lg text-sm text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {rawText}
                    </div>
                  </details>
                )}
              </div>

              <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
                <h3 className="text-blue-300 font-medium mb-2 flex items-center gap-2">
                  <File className="w-4 h-4" />
                  支持的文档格式
                </h3>
                <ul className="text-sm text-blue-200/70 space-y-1">
                  <li>• <strong>Word文档</strong> (.docx) - 推荐使用</li>
                  <li>• <strong>PDF文档</strong> (.pdf) - 需为文字型PDF</li>
                  <li>• <strong>文本文档</strong> (.txt) - 纯文本格式</li>
                  <li>• <strong>OFD文档</strong> (.ofd) - 国产格式，可能需转换</li>
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              {result ? (
                <>
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-blue-800/30">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        识别结果
                      </h2>
                      <span className="text-sm text-slate-400">{result.fileName}</span>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        识别到的参会部门 ({result.departmentsFound.length} 个)
                      </h3>
                      {result.departmentsFound.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {result.departmentsFound.map((dept) => (
                            <span
                              key={dept}
                              className="px-3 py-1.5 bg-blue-900/50 text-blue-300 rounded-full text-sm border border-blue-700/50"
                            >
                              {dept}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">未识别到匹配的部门</p>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-green-400" />
                        待添加收文人员 ({result.totalReceivers} 人)
                      </h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {result.receiversToAdd.length > 0 ? (
                          result.receiversToAdd.map((receiver, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 bg-slate-900/50 rounded-lg p-3 border border-slate-700/50"
                            >
                              <div className="w-8 h-8 bg-green-600/20 rounded-full flex items-center justify-center text-green-400 font-medium text-sm">
                                {index + 1}
                              </div>
                              <span className="text-slate-200">{receiver}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400 text-sm">暂无匹配的收文人员</p>
                        )}
                      </div>
                    </div>

                    {matchedDetails.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <h4 className="text-xs font-medium text-slate-400 mb-2">
                          匹配详情 ({matchedDetails.length}个)
                        </h4>
                        <div className="text-xs text-slate-500 space-y-1 max-h-40 overflow-y-auto">
                          {matchedDetails.map((m, i) => (
                            <div key={i}>• {m.dept} ← {m.matched} {m.category ? `(${m.category})` : ''}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 微信搜索关键词区域 */}
                  {wechatSearchKeywords && (
                    <div className="bg-purple-900/30 border border-purple-700/40 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-purple-300 font-medium flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          微信搜索关键词 ({result.departmentsFound.length}个)
                        </h3>
                        <button
                          onClick={copyWechatKeywords}
                          className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          复制
                        </button>
                      </div>
                      <p className="text-xs text-purple-200/60 mb-2">
                        复制后粘贴到微信搜索框，可批量搜索联系人
                      </p>
                      <div className="bg-slate-900/50 rounded-lg p-3 text-sm text-purple-200 break-all leading-relaxed">
                        {wechatSearchKeywords}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={copyReceivers}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Copy className="w-5 h-5" />
                      复制收文人员
                    </button>
                    <button
                      onClick={copyMatchedDepartments}
                      className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Building2 className="w-5 h-5" />
                      复制部门名单
                    </button>
                  </div>

                  <button
                    onClick={downloadResult}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    导出完整结果
                  </button>

                  <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-300 font-medium">下一步操作</p>
                        <p className="text-sm text-amber-200/70 mt-1">
                          复制"微信搜索关键词"后，打开微信PC版，粘贴到搜索框。微信会依次搜索每个"XX收文"联系人，点击添加即可批量选择收文人员。
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-12 border border-blue-800/30 text-center">
                  <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">上传通知文档或粘贴内容开始处理</p>
                  <p className="text-slate-500 text-sm mt-2">
                    共收录 {departments.length} 个部门/街道（含简称）
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-blue-800/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                崇川区部门通讯录（含简称）
              </h2>
              <span className="text-sm text-slate-400">共 {departments.length} 个部门/街道</span>
            </div>

            <div className="space-y-6">
              {Object.entries(groupedDepartments).map(([category, depts]) => (
                <div key={category}>
                  <h3 className="text-blue-300 font-medium mb-3">{categoryNames[category] || category}</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {depts.map((dept) => (
                      <div
                        key={dept.name}
                        className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50"
                      >
                        <h4 className="text-white font-medium text-sm">{dept.name}</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          匹配词: {dept.keywords.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* 区领导秘书名单 */}
              <div>
                <h3 className="text-blue-300 font-medium mb-3">区领导秘书（9人）</h3>
                <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {LEADERSHIP_SECRETARIES.map((name) => (
                    <div
                      key={name}
                      className="bg-purple-900/30 rounded-lg p-2 border border-purple-700/50"
                    >
                      <h4 className="text-purple-200 font-medium text-sm">{name}</h4>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-900/20 rounded-lg border border-blue-800/30">
              <h4 className="text-blue-300 font-medium text-sm mb-2">收文人员配置</h4>
              <p className="text-sm text-blue-200/70">
                <strong>单位格式：</strong>单位名称+收文（如"城东街道收文"、"崇川开发区收文"、"崇川国投收文"）<br/>
                <strong>秘书格式：</strong>姓名+收文（如"吴佳华收文"、"李建波收文"）<br/>
                请确保微信通讯录中的联系人昵称与本系统生成的关键词一致。
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-6 text-center text-sm text-slate-500">
        无痛发文 v5.3 - 崇川区专用版
      </footer>
    </div>
  );
}

export default App;
