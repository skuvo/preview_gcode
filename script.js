// 初始化编辑器
const editor = document.getElementById('gcode-editor');
const lineNumbers = document.getElementById('line-numbers');
editor.contentEditable = 'true';
editor.spellcheck = false;
editor.innerHTML = ''; // 清空初始内容

// 存储节点编号信息
let nodeIndexMap = new Map();
let isProcessing = false; // 标记是否正在处理输入
let isTableUpdating = false; // 标记是否正在从表格更新G代码

// 禁用自动高亮
let disableHighlight = false;

// 撤销/重做功能相关变量
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50; // 最大历史记录数量
let isUndoRedoAction = false; // 标记是否正在执行撤销/重做操作

// 存储当前文本，用于检测变化
let currentText = '';

// 全局变量，用于存储节点位置信息
let nodePositions = [];
// 当前悬停的节点
let currentHoveredNode = null;

// 表格相关变量
let tableData = [];
let selectedRowIndex = -1; // 当前选中的表格行索引

// 语言相关变量
let currentLanguage = 'zh'; // 默认语言为中文

// 语言文本映射
const languageTexts = {
    // 错误信息
    'error_duplicate_nodes': {
        'zh': '发现重复节点: ',
        'en': 'Duplicate nodes found: '
    },
    'error_no_errors': {
        'zh': '未发现错误，G代码有效。',
        'en': 'No errors found, G-code is valid.'
    },
    'error_nodes_found': {
        'zh': '共找到节点数量: ',
        'en': 'Total nodes found: '
    },
    'error_check_complete': {
        'zh': 'G代码检查完成',
        'en': 'G-code check completed'
    },
    'error_processing': {
        'zh': '处理输入事件时出错:',
        'en': 'Error processing input event:'
    },
    'error_applying_table': {
        'zh': '应用表格数据到G代码时出错:',
        'en': 'Error applying table data to G-code:'
    },
    
    // 搜索相关
    'search_count': {
        'zh': '第 {0} 个，共 {1} 个',
        'en': '{0} of {1}'
    },
    'search_no_results': {
        'zh': '未找到匹配项',
        'en': 'No matches found'
    },
    
    // 表格相关
    'table_command': {
        'zh': '命令',
        'en': 'Command'
    },
    
    // 节点相关
    'node_click_to_close': {
        'zh': '点击关闭',
        'en': 'Click to close'
    },
    'node_overlapping': {
        'zh': '重叠节点',
        'en': 'Overlapping nodes'
    }
};

// 切换语言函数
function switchLanguage(lang) {
    if (lang !== 'zh' && lang !== 'en') return;
    
    currentLanguage = lang;
    
    // 更新语言按钮状态
    document.getElementById('lang-zh').classList.toggle('active', lang === 'zh');
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');
    
    // 更新页面标题
    const titleElement = document.querySelector('title');
    if (titleElement && titleElement.hasAttribute('data-lang-' + lang)) {
        titleElement.textContent = titleElement.getAttribute('data-lang-' + lang);
    }
    
    // 更新所有带有data-lang-zh和data-lang-en属性的元素
    document.querySelectorAll('[data-lang-' + lang + ']').forEach(el => {
        el.textContent = el.getAttribute('data-lang-' + lang);
    });
    
    // 特殊处理h2元素中的span和small
    document.querySelectorAll('h2 > span').forEach(el => {
        if (el.hasAttribute('data-lang-' + lang)) {
            el.textContent = el.getAttribute('data-lang-' + lang);
        }
    });
    
    document.querySelectorAll('h2 > small').forEach(el => {
        if (el.hasAttribute('data-lang-' + lang)) {
            el.textContent = el.getAttribute('data-lang-' + lang);
        }
    });
    
    // 更新所有带有data-lang-title-zh和data-lang-title-en属性的元素
    document.querySelectorAll('[data-lang-title-' + lang + ']').forEach(el => {
        el.title = el.getAttribute('data-lang-title-' + lang);
    });
    
    // 更新所有带有data-lang-placeholder-zh和data-lang-placeholder-en属性的元素
    document.querySelectorAll('[data-lang-placeholder-' + lang + ']').forEach(el => {
        el.placeholder = el.getAttribute('data-lang-placeholder-' + lang);
    });
    
    // 重新渲染表格
    renderTable();
    
    // 将当前语言保存到localStorage
    localStorage.setItem('language', lang);
    
    console.log('语言已切换为:', lang === 'zh' ? '中文' : 'English');
}

// 获取当前语言的文本
function getText(key, ...args) {
    let text = languageTexts[key]?.[currentLanguage] || key;
    
    // 替换参数
    for (let i = 0; i < args.length; i++) {
        text = text.replace('{' + i + '}', args[i]);
    }
    
    return text;
}

// 监听编辑器输入事件
editor.addEventListener('input', function(e) {
    if (isProcessing || disableHighlight) return;
    
    // 防止循环触发
    isProcessing = true;
    
    // 延迟处理，让浏览器有时间更新DOM
    setTimeout(() => {
        try {
            // 获取当前光标位置
            const cursorPosition = getCursorPosition(editor);
            
            // 获取当前文本
            const newText = editor.innerText;
            
            // 如果不是撤销/重做操作且文本有变化，则添加到撤销栈
            if (!isUndoRedoAction && newText !== currentText) {
                // 添加到撤销栈
                undoStack.push(currentText);
                // 清空重做栈
                redoStack = [];
                // 限制撤销栈大小
                if (undoStack.length > MAX_HISTORY) {
                    undoStack.shift();
                }
                // 更新当前文本
                currentText = newText;
            }
            
            // 分析并更新节点编号
            nodeIndexMap = new Map();
            analyzeGcode(newText);
            updateLineNumbers();
            
            // 绘制G-code - 这是关键步骤，确保在文本变化时重新绘制
            drawGcode(newText);
            
            // 如果不是从表格更新G代码，则更新表格数据
            if (!isTableUpdating) {
                updateTableFromGcode();
            }
            
            // 高亮处理
            const text = editor.innerText;
            const highlightedText = highlightGcode(text);
            
            // 更新编辑器内容
            disableHighlight = true;
            editor.innerHTML = highlightedText;
            disableHighlight = false;
            
            // 恢复光标位置
            setCursorPosition(editor, cursorPosition);
        } catch (error) {
            console.error(getText("error_processing"), error);
        } finally {
            isProcessing = false;
            isUndoRedoAction = false; // 重置撤销/重做标记
        }
    }, 10);
});

// 监听编辑器滚动事件，同步行号区域的滚动
editor.addEventListener('scroll', function() {
    lineNumbers.scrollTop = editor.scrollTop;
});

// 监听粘贴事件，防止粘贴带格式的文本
editor.addEventListener('paste', function(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
});

// 为编辑器添加高亮样式的函数
function applyHighlighting() {
    if (disableHighlight) return;
    
    // 获取当前选择以便稍后恢复
    const sel = window.getSelection();
    let cursorPosition = 0;
    
    if (sel.rangeCount > 0) {
        // 获取编辑器中的光标位置
        const range = sel.getRangeAt(0);
        // 创建一个范围来测量光标位置
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(editor);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        cursorPosition = preCaretRange.toString().length;
    }
    
    // 获取当前文本并高亮处理
    const text = editor.innerText;
    const highlightedText = highlightGcode(text);
    
    // 更新编辑器内容（临时禁用高亮以防止循环）
    disableHighlight = true;
    editor.innerHTML = highlightedText;
    disableHighlight = false;
    
    // 尝试恢复光标位置
    if (cursorPosition > 0) {
        setCursorPosition(editor, cursorPosition);
    }
}

// 设置光标位置的辅助函数
function setCursorPosition(element, position) {
    // 使用createTreeWalker遍历所有文本节点
    const treeWalker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let currentLength = 0;
    let node = treeWalker.nextNode();
    
    // 查找光标应该所在的节点
    while (node) {
        if (currentLength + node.length >= position) {
            const range = document.createRange();
            const sel = window.getSelection();
            
            range.setStart(node, position - currentLength);
            range.collapse(true);
            
            sel.removeAllRanges();
            sel.addRange(range);
            break;
        }
        currentLength += node.length;
        node = treeWalker.nextNode();
    }
}

// 高亮G-code的函数（不修改DOM，只返回HTML字符串）
function highlightGcode(text) {
    let result = '';
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 跳过空行
        if (line.trim() === '') {
            result += '\n';
            continue;
        }
        
        // 处理注释行
        if (line.trim().startsWith(';')) {
            result += `<span class="comment">${line}</span>`;
            if (i < lines.length - 1) result += '\n';
            continue;
        }
        
        // 查找注释部分
        const commentIndex = line.indexOf(';');
        let codePart = line;
        let commentPart = '';
        
        if (commentIndex !== -1) {
            codePart = line.substring(0, commentIndex);
            commentPart = line.substring(commentIndex);
        }
        
        // 分词处理代码部分
        const tokens = codePart.trim().split(/\s+/);
        let lineHtml = '';
        
        for (let j = 0; j < tokens.length; j++) {
            const token = tokens[j];
            if (token === '') continue;
            
            // 处理G代码关键词
            if (/^(G\d+|M\d+)/i.test(token)) {
                lineHtml += `<span class="keyword">${token}</span>`;
            }
            // 处理坐标 - 支持大小写
            else if (/^[XYZxyz]-?\d+(\.\d+)?/.test(token)) {
                // 分离坐标轴和数值
                const axis = token.charAt(0).toUpperCase();
                const value = token.substring(1);
                lineHtml += `<span class="coordinate">${axis}${value}</span>`;
            }
            // 处理其他参数
            else if (/^[A-Za-z]-?\d+(\.\d+)?/.test(token)) {
                lineHtml += `<span class="coordinate">${token}</span>`;
            }
            // 其他内容
            else {
                lineHtml += token;
            }
            
            // 添加空格
            if (j < tokens.length - 1) {
                lineHtml += ' ';
            }
        }
        
        // 添加注释部分
        if (commentPart) {
            lineHtml += `<span class="comment">${commentPart}</span>`;
        }
        
        result += lineHtml;
        if (i < lines.length - 1) result += '\n';
    }
    
    return result;
}

// 处理回车键的特殊函数
editor.addEventListener('keydown', function(e) {
    // 处理撤销/重做快捷键
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault(); // 阻止默认行为
        
        // 如果同时按下Shift，则执行重做
        if (e.shiftKey) {
            performRedo();
        } else {
            // 否则执行撤销
            performUndo();
        }
        return;
    }
    
    // 处理重做快捷键 (Ctrl+Y)
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault(); // 阻止默认行为
        performRedo();
        return;
    }
    
    // 只处理回车键
    if (e.key === 'Enter') {
        e.preventDefault(); // 阻止默认行为
        
        // 获取当前选择
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            
            // 将选区折叠到光标位置
            range.collapse(true);
            
            // 获取光标所在节点和偏移量
            const node = range.startContainer;
            const offset = range.startOffset;
            
            // 判断是否在文本节点内
            if (node.nodeType === Node.TEXT_NODE) {
                // 获取光标前后的文本
                const textBefore = node.textContent.substring(0, offset);
                const textAfter = node.textContent.substring(offset);
                
                // 更新当前节点为光标前的文本
                node.textContent = textBefore;
                
                // 创建换行符和后续文本的节点
                const newLineNode = document.createTextNode('\n');
                const afterTextNode = document.createTextNode(textAfter);
                
                // 插入节点到DOM中
                const parentNode = node.parentNode;
                if (node.nextSibling) {
                    parentNode.insertBefore(newLineNode, node.nextSibling);
                    parentNode.insertBefore(afterTextNode, newLineNode.nextSibling);
                } else {
                    parentNode.appendChild(newLineNode);
                    parentNode.appendChild(afterTextNode);
                }
                
                // 将光标移动到新行的开头
                range.setStart(afterTextNode, 0);
                range.setEnd(afterTextNode, 0);
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                // 如果不在文本节点内，直接插入换行符
                const newLineNode = document.createTextNode('\n');
                range.insertNode(newLineNode);
                
                // 将光标移动到换行符后
                range.setStartAfter(newLineNode);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            // 获取当前光标位置，用于稍后恢复
            const cursorPosition = getCursorPosition(editor);
            
            // 手动触发更新
            setTimeout(() => {
                // 保存当前文本到撤销栈
                if (currentText !== editor.innerText) {
                    undoStack.push(currentText);
                    redoStack = [];
                    if (undoStack.length > MAX_HISTORY) {
                        undoStack.shift();
                    }
                    currentText = editor.innerText;
                }
                
                nodeIndexMap = new Map();
                analyzeGcode(editor.innerText);
                updateLineNumbers();
                
                drawGcode(editor.innerText);
                
                // 高亮处理
                const text = editor.innerText;
                const highlightedText = highlightGcode(text);
                
                // 更新编辑器内容
                disableHighlight = true;
                editor.innerHTML = highlightedText;
                disableHighlight = false;
                
                // 恢复光标位置
                setCursorPosition(editor, cursorPosition);
            }, 10);
        }
    } 
    // 空格键处理
    else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); // 阻止默认行为
        
        // 获取当前选择
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            
            // 将选区折叠到光标位置
            range.collapse(true);
            
            // 插入空格
            const spaceNode = document.createTextNode(' ');
            range.insertNode(spaceNode);
            
            // 将光标移动到空格后
            range.setStartAfter(spaceNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            
            // 获取当前光标位置，用于稍后恢复
            const cursorPosition = getCursorPosition(editor);
            
            // 手动触发更新
            setTimeout(() => {
                // 保存当前文本到撤销栈
                if (currentText !== editor.innerText) {
                    undoStack.push(currentText);
                    redoStack = [];
                    if (undoStack.length > MAX_HISTORY) {
                        undoStack.shift();
                    }
                    currentText = editor.innerText;
                }
                
                nodeIndexMap = new Map();
                analyzeGcode(editor.innerText);
                updateLineNumbers();
                
                drawGcode(editor.innerText);
                
                // 高亮处理
                const text = editor.innerText;
                const highlightedText = highlightGcode(text);
                
                // 更新编辑器内容
                disableHighlight = true;
                editor.innerHTML = highlightedText;
                disableHighlight = false;
                
                // 恢复光标位置
                setCursorPosition(editor, cursorPosition);
            }, 10);
        }
    }
});

// 获取光标位置的辅助函数
function getCursorPosition(element) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return 0;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
}

// 更新行号和节点编号
function updateLineNumbers() {
    const lines = editor.innerText.split('\n');
    let lineNumbersHtml = '';
    
    for (let i = 0; i < lines.length; i++) {
        if (nodeIndexMap.has(i)) {
            // 如果该行有节点编号，显示节点编号
            lineNumbersHtml += `<div class="node-marker">${nodeIndexMap.get(i)}</div>`;
        } else {
            // 否则显示行号
            lineNumbersHtml += `<div>${i + 1}</div>`;
        }
    }
    
    lineNumbers.innerHTML = lineNumbersHtml;
}

// 分析G-code并生成节点编号映射
function analyzeGcode(gcode) {
    const lines = gcode.split('\n');
    let x = 0, y = 0, z = 0; // 当前坐标
    let pointIndex = 0;
    
    // 清空节点映射
    nodeIndexMap = new Map();
    
    // 首先检查是否有起始点
    if (x !== 0 || y !== 0 || z !== 0) {
        // 如果起始点不是原点，记录为第一个节点
        nodeIndexMap.set(0, pointIndex++);
    }
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 跳过空行和纯注释行
        if (line === '' || line.startsWith(';')) continue;
        
        // 提取代码部分（去除注释）
        let codeLine = line;
        const commentIndex = line.indexOf(';');
        if (commentIndex !== -1) {
            codeLine = line.substring(0, commentIndex).trim();
        }
        
        if (codeLine === '') continue;
        
        const tokens = codeLine.trim().split(/\s+/);
        const command = tokens[0].toUpperCase();
        
        if (command === 'G0' || command === 'G1') {
            let newX = x, newY = y, newZ = z;
            let hasCoordinateChange = false;
            
            // 提取 X, Y, Z 坐标 (如果有)
            for (const token of tokens) {
                const upperToken = token.toUpperCase();
                if (upperToken.startsWith('X')) {
                    newX = parseFloat(upperToken.substring(1));
                    hasCoordinateChange = true;
                }
                if (upperToken.startsWith('Y')) {
                    newY = parseFloat(upperToken.substring(1));
                    hasCoordinateChange = true;
                }
                if (upperToken.startsWith('Z')) {
                    newZ = parseFloat(upperToken.substring(1));
                    hasCoordinateChange = true;
                }
            }
            
            // 如果坐标有变化，则记录节点编号
            if (hasCoordinateChange) {
                // 记录当前行对应的节点编号
                nodeIndexMap.set(i, pointIndex++);
                
                // 更新当前坐标
                x = newX;
                y = newY;
                z = newZ;
            }
        }
    }
    
    console.log(getText("error_nodes_found"), nodeIndexMap.size);
}

// 保留运行按钮事件监听器，但现在它只是一个备用选项
document.getElementById('run-button').addEventListener('click', () => {
    const gcode = document.getElementById('gcode-editor').innerText;
    nodeIndexMap = new Map();
    analyzeGcode(gcode);
    updateLineNumbers();
    drawGcode(gcode);
    
    // 更新表格数据
    if (!isTableUpdating) {
        updateTableFromGcode();
    }
    
    // 应用高亮但不移动光标
    applyHighlighting();
});

function drawGcode(gcode) {
    const canvas = document.getElementById('gcode-canvas');
    const ctx = canvas.getContext('2d');

    // 设置画布大小
    canvas.width = canvas.parentElement.clientWidth * 0.9;
    canvas.height = canvas.parentElement.clientHeight * 0.9;

    // 1. 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 清空节点位置数组
    nodePositions = [];

    // 2. G-code 解析 (核心部分)
    const lines = gcode.split('\n');
    let x = 0, y = 0, z = 0; // 当前坐标
    let x_pre = 0, y_pre = 0; //记录上一个坐标
    let isExtruding = false; // 是否在挤出

    //设置坐标偏移和比例，让图形显示在画布中间
    const offsetX = canvas.width / 2;
    const offsetY = canvas.height / 2;
    const scale = 5; // 缩放比例
    
    // 存储所有点的坐标，用于编号
    const points = [];
    let pointIndex = 0;
    
    // 如果起始点不是原点，添加起始点
    if (x !== 0 || y !== 0 || z !== 0) {
        points.push({
            x: x * scale + offsetX,
            y: -y * scale + offsetY,
            z: z,
            index: pointIndex++
        });
    }

    for (const line of lines) {
        // 跳过空行和纯注释行
        if (line.trim() === '' || line.trim().startsWith(';')) continue;
        
        // 提取代码部分（去除注释）
        let codeLine = line;
        const commentIndex = line.indexOf(';');
        if (commentIndex !== -1) {
            codeLine = line.substring(0, commentIndex).trim();
        }
        
        if (codeLine === '') continue;
        
        const tokens = codeLine.trim().split(/\s+/);
        const command = tokens[0].toUpperCase();
      
        //只考虑数控铣床的G代码，打印机的其他设置先忽略。
        if (command === 'G0' || command === 'G1') { // 快速移动 或 线性插补
            let newX = x, newY = y, newZ = z;
            let hasCoordinateChange = false;

            // 提取 X, Y, Z 坐标 (如果有)
            for (const token of tokens) {
                const upperToken = token.toUpperCase();
                if (upperToken.startsWith('X')) {
                    newX = parseFloat(upperToken.substring(1));
                    hasCoordinateChange = true;
                }
                if (upperToken.startsWith('Y')) {
                    newY = parseFloat(upperToken.substring(1));
                    hasCoordinateChange = true;
                }
                if (upperToken.startsWith('Z')) {
                    newZ = parseFloat(upperToken.substring(1));
                    hasCoordinateChange = true;
                }
            }

            // 如果坐标有变化，则添加到点集合中
            if (hasCoordinateChange) {
                // 记录终点
                points.push({
                    x: newX * scale + offsetX,
                    y: -newY * scale + offsetY,
                    z: newZ,
                    index: pointIndex++
                });
                
                // 绘图
                ctx.beginPath();
                ctx.moveTo(x * scale + offsetX, -y * scale + offsetY);  // 坐标系转换和缩放, 注意y轴是反的
                ctx.lineTo(newX * scale + offsetX, -newY * scale + offsetY);  // 坐标系转换和缩放

                if(command === 'G0'){
                    ctx.strokeStyle = 'gray'; // 快速移动用灰色
                    ctx.setLineDash([5, 5]);  //虚线
                } else {
                    ctx.strokeStyle = 'blue'; // 插补用蓝色
                    ctx.setLineDash([]); //实线
                }
                
                ctx.stroke();
                
                // 更新当前坐标
                x = newX;
                y = newY;
                z = newZ;
            }
        } else if(command === 'G90'){
            //绝对坐标，不做处理
        } else if(command === 'G91'){
            //相对坐标，先不支持，可以console.log提示用户
            console.warn("不支持相对坐标(G91指令)")
            alert("不支持相对坐标(G91指令)，请使用绝对坐标G90")
            return;
        }
    }
    
    // 创建一个Map来跟踪每个位置的所有节点
    const positionMap = new Map();
    
    // 首先收集所有点的位置信息
    for (const point of points) {
        // 创建位置键（四舍五入到整数以处理浮点误差）
        const posKey = `${Math.round(point.x)},${Math.round(point.y)}`;
        
        if (!positionMap.has(posKey)) {
            positionMap.set(posKey, []);
        }
        
        // 添加点索引到该位置
        positionMap.get(posKey).push(point.index);
    }
    
    // 打印调试信息
    console.log("点集合大小:", points.length);
    console.log("位置映射大小:", positionMap.size);
    
    // 存储节点位置信息，用于鼠标悬停检测
    nodePositions = []; // 再次确保清空
    for (const [posKey, indices] of positionMap.entries()) {
        const [x, y] = posKey.split(',').map(Number);
        nodePositions.push({
            x: x,
            y: y,
            radius: 5, // 减小检测半径，使hover更精确
            indices: indices,
            originalX: x,
            originalY: y
        });
    }
    
    // 绘制所有点和标签
    drawNodesAndLabels(ctx, points, positionMap);
    
    // 添加鼠标悬停事件处理
    setupHoverEvents(canvas);
}

// 绘制所有节点和标签
function drawNodesAndLabels(ctx, points, positionMap) {
    // 绘制点的编号
    ctx.setLineDash([]); // 重置线型为实线
    
    console.log("绘制节点总数:", points.length);
    console.log("位置映射大小:", positionMap.size);
    
    // 绘制所有点
    for (const point of points) {
        // 如果当前有悬停的节点，且该点属于悬停节点，则跳过（将在后面单独绘制）
        if (currentHoveredNode && 
            Math.round(point.x) === Math.round(currentHoveredNode.x) && 
            Math.round(point.y) === Math.round(currentHoveredNode.y)) {
            continue;
        }
        
        // 获取该位置的所有点索引
        const posKey = `${Math.round(point.x)},${Math.round(point.y)}`;
        const indices = positionMap.get(posKey);
        
        if (!indices) {
            console.warn("找不到位置的索引:", posKey);
            continue;
        }
        
        // 绘制点
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        
        // 如果是重叠点，使用不同的颜色
        if (indices.length > 1) {
            ctx.fillStyle = '#ff5500'; // 橙红色
            
            // 为重叠点添加高亮环
            ctx.fill();
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff5500';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else {
            ctx.fillStyle = 'red';
            ctx.fill();
        }
        
        // 如果该位置只有一个点，直接显示编号
        if (indices.length === 1) {
            // 绘制编号背景
            ctx.beginPath();
            ctx.arc(point.x, point.y - 10, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // 绘制编号
            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(point.index.toString(), point.x, point.y - 10);
        } else {
            // 如果有多个点重叠，只显示第一个点的编号，但添加一个小标记表示有多个点
            if (point.index === indices[0]) {
                // 绘制编号背景 - 使用不同的背景颜色表示重叠
                ctx.beginPath();
                ctx.arc(point.x, point.y - 10, 8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 240, 200, 0.9)';
                ctx.fill();
                ctx.strokeStyle = '#ff5500';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                
                // 绘制编号
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = 'black';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.index.toString(), point.x, point.y - 10);
                
                // 添加一个小标记表示有多个点
                ctx.font = 'bold 10px Arial';
                ctx.fillStyle = '#cc0000';
                ctx.fillText(`+${indices.length-1}`, point.x + 10, point.y - 15);
            }
        }
    }
    
    // 如果有悬停的节点，绘制展开的节点圆圈
    if (currentHoveredNode) {
        drawExpandedNodes(ctx, currentHoveredNode);
    }
}

// 绘制展开的节点圆圈
function drawExpandedNodes(ctx, node) {
    if (!node || !node.overlappingIndices || node.overlappingIndices.length === 0) return;
    
    const centerX = node.x;
    const centerY = node.y;
    const radius = 30; // 展开半径
    
    // 绘制中心点的高亮环
    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#ff5252';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 绘制"点击关闭"提示
    ctx.font = '12px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText(getText("node_click_to_close"), centerX, centerY - 20);
    
    // 绘制"重叠节点"标题
    ctx.font = 'bold 14px Arial';
    ctx.fillText(getText("node_overlapping"), centerX, centerY - 40);
    
    // 计算每个节点的位置
    const count = node.overlappingIndices.length;
    const angleStep = (Math.PI * 2) / count;
    
    for (let i = 0; i < count; i++) {
        const angle = i * angleStep;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const index = node.overlappingIndices[i];
        
        // 绘制连接线
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // 绘制节点
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ff5252';
        ctx.fill();
        
        // 绘制节点编号
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(index.toString(), x, y);
    }
}

// 设置鼠标悬停事件
function setupHoverEvents(canvas) {
    // 移除之前的事件监听器（如果有）
    canvas.removeEventListener('mousemove', handleMouseMove);
    canvas.removeEventListener('mouseout', handleMouseOut);
    canvas.removeEventListener('click', handleMouseClick);
    
    // 添加新的事件监听器
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseout', handleMouseOut);
    canvas.addEventListener('click', handleMouseClick);
}

// 处理鼠标移动事件
function handleMouseMove(e) {
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 检查鼠标是否在任何节点上
    let hoveredNode = null;
    let minDistance = Infinity;
    
    // 确保nodePositions数组不为空
    if (nodePositions.length === 0) {
        drawGcode(editor.innerText);
        return;
    }
    
    // 找到最近的节点
    for (const node of nodePositions) {
        const distance = Math.sqrt(Math.pow(mouseX - node.x, 2) + Math.pow(mouseY - node.y, 2));
        if (distance <= node.radius && distance < minDistance) {
            hoveredNode = node;
            minDistance = distance;
        }
    }
    
    // 如果鼠标在节点上，设置鼠标样式为指针
    if (hoveredNode) {
        canvas.style.cursor = 'pointer';
        
        // 如果当前已经有展开的节点，且鼠标移动到了其他节点，则关闭展开的节点
        if (currentHoveredNode && 
            (currentHoveredNode.x !== hoveredNode.x || 
             currentHoveredNode.y !== hoveredNode.y)) {
            currentHoveredNode = null;
            // 重绘画布
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGcode(editor.innerText);
        }
    } else {
        // 如果鼠标不在任何节点上，且当前没有展开的节点，恢复默认鼠标样式
        if (!currentHoveredNode) {
            canvas.style.cursor = 'default';
        }
    }
    
    // 检查鼠标是否在展开的节点圆圈上
    if (currentHoveredNode) {
        const indices = currentHoveredNode.indices;
        const centerX = currentHoveredNode.originalX;
        const centerY = currentHoveredNode.originalY;
        const radius = 30; // 展开圆的半径
        
        // 计算每个节点的位置
        const angleStep = (2 * Math.PI) / indices.length;
        
        for (let i = 0; i < indices.length; i++) {
            const angle = i * angleStep;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            // 检查鼠标是否在节点圆圈上
            const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));
            if (distance <= 12) { // 节点圆圈半径
                // 设置鼠标样式为指针
                canvas.style.cursor = 'pointer';
                break;
            }
        }
    }
}

// 处理鼠标离开事件
function handleMouseOut() {
    // 重置悬停节点
    if (currentHoveredNode) {
        currentHoveredNode = null;
        
        // 重绘画布
        const canvas = document.getElementById('gcode-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGcode(editor.innerText);
        
        // 恢复默认鼠标样式
        canvas.style.cursor = 'default';
    }
}

// 处理鼠标点击事件
function handleMouseClick(e) {
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 如果当前有悬停的节点，检查是否点击了展开的节点圆圈
    if (currentHoveredNode) {
        const indices = currentHoveredNode.indices;
        const centerX = currentHoveredNode.originalX;
        const centerY = currentHoveredNode.originalY;
        const radius = 30; // 展开圆的半径
        
        // 检查是否点击了中心点
        const distanceToCenter = Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2));
        if (distanceToCenter <= 8) { // 中心点半径
            // 关闭展开的节点
            currentHoveredNode = null;
            // 重绘画布
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGcode(editor.innerText);
            return;
        }
        
        // 计算每个节点的位置
        const angleStep = (2 * Math.PI) / indices.length;
        
        for (let i = 0; i < indices.length; i++) {
            const angle = i * angleStep;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            // 检查鼠标是否在节点圆圈上
            const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));
            if (distance <= 12) { // 节点圆圈半径
                // 高亮显示对应的代码行
                highlightNodeLine(indices[i]);
                return;
            }
        }
    } else {
        // 检查是否点击了普通节点
        let minDistance = Infinity;
        let clickedNode = null;
        
        for (const node of nodePositions) {
            const distance = Math.sqrt(Math.pow(mouseX - node.x, 2) + Math.pow(mouseY - node.y, 2));
            if (distance <= node.radius && distance < minDistance) {
                clickedNode = node;
                minDistance = distance;
            }
        }
        
        if (clickedNode) {
            // 如果只有一个节点，直接高亮显示
            if (clickedNode.indices.length === 1) {
                highlightNodeLine(clickedNode.indices[0]);
            }
            // 如果有多个节点，设置为当前悬停节点，展开显示
            else if (clickedNode.indices.length > 1) {
                // 如果点击的是当前已展开的节点，则关闭展开
                if (currentHoveredNode && 
                    currentHoveredNode.x === clickedNode.x && 
                    currentHoveredNode.y === clickedNode.y) {
                    currentHoveredNode = null;
                } else {
                    currentHoveredNode = clickedNode;
                }
                
                // 重绘画布
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawGcode(editor.innerText);
            }
        } else if (currentHoveredNode) {
            // 如果点击了空白区域，关闭展开的节点
            currentHoveredNode = null;
            // 重绘画布
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGcode(editor.innerText);
        }
    }
}

// 高亮显示与节点对应的代码行
function highlightNodeLine(nodeIndex) {
    // 查找对应的行号
    let lineIndex = -1;
    for (const [line, index] of nodeIndexMap.entries()) {
        if (index === nodeIndex) {
            lineIndex = line;
            break;
        }
    }
    
    if (lineIndex >= 0) {
        // 高亮显示该行
        highlightErrorLine(lineIndex);
        scrollToLine(lineIndex);
    }
}

// 初始化时添加一些示例G-code
editor.innerHTML = `G90 ; 绝对坐标模式
G0 X0 Y0 Z5 ; 快速移动到起点上方
G1 Z0 ; 下降到工作平面
G1 X10 Y0 ; 直线移动
G1 X10 Y10
G1 X0 Y10
G1 X0 Y0 ; 回到起点
G0 Z5 ; 抬起工具`;

// 初始化当前文本变量
currentText = editor.innerText;

// 初始化时执行一次分析
nodeIndexMap = new Map();
analyzeGcode(editor.innerText);

// 初始化时更新行号
updateLineNumbers();

// 初始化时高亮代码
applyHighlighting();

// 初始化时绘图
drawGcode(editor.innerText);

// 添加一个测试按钮，用于调试
document.getElementById('check-btn').addEventListener('click', () => {
    console.log("节点映射大小:", nodeIndexMap.size);
    console.log("节点位置数组大小:", nodePositions.length);
    
    // 检查G-code错误
    checkGcodeErrors(editor.innerText);
});

// 查找/替换功能实现
// 全局变量，用于存储搜索状态
let searchState = {
    searchText: '',
    replaceText: '',
    matches: [],
    currentMatchIndex: -1,
    caseSensitive: false,
    wholeWord: false,
    isSearchActive: false
};

// 切换搜索面板显示/隐藏
document.getElementById('search-toggle').addEventListener('click', function() {
    const searchPanel = document.getElementById('search-panel');
    searchPanel.classList.toggle('hidden');
    
    if (!searchPanel.classList.contains('hidden')) {
        // 当面板显示时，聚焦到搜索输入框
        document.getElementById('search-input').focus();
        
        // 如果搜索框中已有内容，立即执行搜索
        const searchInput = document.getElementById('search-input');
        if (searchInput.value.trim() !== '') {
            performSearch(searchInput.value);
        }
    } else {
        // 当面板隐藏时，清除所有高亮
        clearSearchHighlights();
        searchState.isSearchActive = false;
    }
});

// 监听搜索输入框的输入事件
document.getElementById('search-input').addEventListener('input', function(e) {
    const searchText = e.target.value;
    if (searchText.trim() !== '') {
        performSearch(searchText);
    } else {
        clearSearchHighlights();
        updateSearchCount(0, 0);
    }
});

// 监听搜索选项变化
document.getElementById('case-sensitive').addEventListener('change', function(e) {
    searchState.caseSensitive = e.target.checked;
    if (searchState.searchText) {
        performSearch(searchState.searchText);
    }
});

document.getElementById('whole-word').addEventListener('change', function(e) {
    searchState.wholeWord = e.target.checked;
    if (searchState.searchText) {
        performSearch(searchState.searchText);
    }
});

// 下一个匹配
document.getElementById('search-next').addEventListener('click', function() {
    if (searchState.matches.length > 0) {
        searchState.currentMatchIndex = (searchState.currentMatchIndex + 1) % searchState.matches.length;
        highlightCurrentMatch();
    }
});

// 上一个匹配
document.getElementById('search-prev').addEventListener('click', function() {
    if (searchState.matches.length > 0) {
        searchState.currentMatchIndex = (searchState.currentMatchIndex - 1 + searchState.matches.length) % searchState.matches.length;
        highlightCurrentMatch();
    }
});

// 替换当前匹配
document.getElementById('replace-btn').addEventListener('click', function() {
    const replaceText = document.getElementById('replace-input').value;
    if (searchState.matches.length > 0 && searchState.currentMatchIndex >= 0) {
        replaceCurrentMatch(replaceText);
    }
});

// 替换所有匹配
document.getElementById('replace-all-btn').addEventListener('click', function() {
    const replaceText = document.getElementById('replace-input').value;
    if (searchState.matches.length > 0) {
        replaceAllMatches(replaceText);
    }
});

// 执行搜索
function performSearch(searchText) {
    // 保存搜索文本
    searchState.searchText = searchText;
    searchState.isSearchActive = true;
    
    // 清除之前的高亮
    clearSearchHighlights();
    
    // 获取编辑器文本
    const editorText = editor.innerText;
    
    // 创建正则表达式
    let flags = 'g';
    if (!searchState.caseSensitive) {
        flags += 'i';
    }
    
    let searchPattern = searchText;
    if (searchState.wholeWord) {
        searchPattern = '\\b' + searchPattern + '\\b';
    }
    
    try {
        const regex = new RegExp(searchPattern, flags);
        
        // 查找所有匹配
        searchState.matches = [];
        let match;
        while ((match = regex.exec(editorText)) !== null) {
            searchState.matches.push({
                start: match.index,
                end: match.index + match[0].length,
                text: match[0]
            });
        }
        
        // 更新匹配计数
        updateSearchCount(searchState.matches.length, 0);
        
        // 如果有匹配，高亮第一个
        if (searchState.matches.length > 0) {
            searchState.currentMatchIndex = 0;
            highlightCurrentMatch();
        }
    } catch (e) {
        console.error('搜索正则表达式错误:', e);
        // 显示错误信息
        updateSearchCount(0, 0, '无效的搜索表达式');
    }
}

// 更新搜索计数显示
function updateSearchCount(total, current, errorMsg) {
    const searchCount = document.getElementById('search-count');
    
    if (total === 0) {
        searchCount.textContent = getText("search_no_results");
        searchCount.classList.add('error');
    } else {
        searchCount.textContent = getText("search_count", current + 1, total);
        searchCount.classList.remove('error');
    }
    
    if (errorMsg) {
        searchCount.textContent = errorMsg;
        searchCount.classList.add('error');
    }
}

// 高亮当前匹配
function highlightCurrentMatch() {
    if (searchState.matches.length === 0 || searchState.currentMatchIndex < 0) {
        return;
    }
    
    // 获取当前匹配
    const currentMatch = searchState.matches[searchState.currentMatchIndex];
    
    // 更新计数显示
    updateSearchCount(searchState.matches.length, searchState.currentMatchIndex);
    
    // 高亮所有匹配
    highlightAllMatches();
    
    // 特别高亮当前匹配
    const editorText = editor.innerText;
    const beforeText = editorText.substring(0, currentMatch.start);
    const matchText = editorText.substring(currentMatch.start, currentMatch.end);
    const afterText = editorText.substring(currentMatch.end);
    
    // 临时禁用高亮处理
    disableHighlight = true;
    
    // 保存当前选择
    const sel = window.getSelection();
    let savedRange = null;
    if (sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0).cloneRange();
    }
    
    // 滚动到当前匹配位置
    scrollToMatch(currentMatch);
    
    disableHighlight = false;
}

// 高亮所有匹配
function highlightAllMatches() {
    if (searchState.matches.length === 0) {
        return;
    }
    
    // 获取编辑器文本
    const editorText = editor.innerText;
    
    // 构建带有高亮的HTML
    let resultHtml = '';
    let lastIndex = 0;
    
    for (let i = 0; i < searchState.matches.length; i++) {
        const match = searchState.matches[i];
        
        // 添加匹配前的文本
        resultHtml += escapeHtml(editorText.substring(lastIndex, match.start));
        
        // 添加高亮的匹配文本
        const highlightClass = (i === searchState.currentMatchIndex) ? 'search-highlight-current' : 'search-highlight';
        resultHtml += `<span class="${highlightClass}">${escapeHtml(match.text)}</span>`;
        
        lastIndex = match.end;
    }
    
    // 添加最后一个匹配后的文本
    resultHtml += escapeHtml(editorText.substring(lastIndex));
    
    // 临时禁用高亮处理
    disableHighlight = true;
    
    // 保存当前选择
    const sel = window.getSelection();
    let savedRange = null;
    if (sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0).cloneRange();
    }
    
    // 更新编辑器内容
    editor.innerHTML = resultHtml;
    
    // 恢复高亮处理
    disableHighlight = false;
}

// 清除搜索高亮
function clearSearchHighlights() {
    if (!searchState.isSearchActive) {
        return;
    }
    
    // 重新应用普通的G-code高亮
    applyHighlighting();
    
    // 重置搜索状态
    searchState.matches = [];
    searchState.currentMatchIndex = -1;
    
    // 清除计数显示
    updateSearchCount(0, 0);
}

// 滚动到匹配位置
function scrollToMatch(match) {
    // 创建一个范围来定位匹配
    const range = document.createRange();
    const sel = window.getSelection();
    
    // 使用createTreeWalker遍历所有文本节点
    const treeWalker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let currentPos = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;
    
    // 查找包含匹配的文本节点
    let node = treeWalker.nextNode();
    while (node) {
        const nodeLength = node.length;
        
        // 检查这个节点是否包含匹配的开始位置
        if (currentPos <= match.start && match.start < currentPos + nodeLength) {
            startNode = node;
            startOffset = match.start - currentPos;
        }
        
        // 检查这个节点是否包含匹配的结束位置
        if (currentPos <= match.end && match.end <= currentPos + nodeLength) {
            endNode = node;
            endOffset = match.end - currentPos;
            break;
        }
        
        currentPos += nodeLength;
        node = treeWalker.nextNode();
    }
    
    // 如果找到了匹配的节点
    if (startNode && endNode) {
        // 设置选择范围
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        
        sel.removeAllRanges();
        sel.addRange(range);
        
        // 滚动到可见区域
        const matchElement = document.querySelector('.search-highlight-current');
        if (matchElement) {
            matchElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }
}

// 替换当前匹配
function replaceCurrentMatch(replaceText) {
    if (searchState.matches.length === 0 || searchState.currentMatchIndex < 0) {
        return;
    }
    
    // 获取当前匹配
    const currentMatch = searchState.matches[searchState.currentMatchIndex];
    
    // 获取编辑器文本
    const editorText = editor.innerText;
    
    // 构建替换后的文本
    const newText = editorText.substring(0, currentMatch.start) + 
                   replaceText + 
                   editorText.substring(currentMatch.end);
    
    // 更新编辑器内容
    disableHighlight = true;
    editor.innerText = newText;
    
    // 保存到撤销栈
    if (currentText !== newText) {
        undoStack.push(currentText);
        redoStack = [];
        if (undoStack.length > MAX_HISTORY) {
            undoStack.shift();
        }
        currentText = newText;
    }
    
    // 重新分析和绘制
    nodeIndexMap = new Map();
    analyzeGcode(newText);
    updateLineNumbers();
    drawGcode(newText);
    
    // 重新执行搜索
    performSearch(searchState.searchText);
    
    disableHighlight = false;
}

// 替换所有匹配
function replaceAllMatches(replaceText) {
    if (searchState.matches.length === 0) {
        return;
    }
    
    // 获取编辑器文本
    let editorText = editor.innerText;
    
    // 创建正则表达式
    let flags = 'g';
    if (!searchState.caseSensitive) {
        flags += 'i';
    }
    
    let searchPattern = searchState.searchText;
    if (searchState.wholeWord) {
        searchPattern = '\\b' + searchPattern + '\\b';
    }
    
    try {
        const regex = new RegExp(searchPattern, flags);
        
        // 执行替换
        const newText = editorText.replace(regex, replaceText);
        
        // 更新编辑器内容
        disableHighlight = true;
        editor.innerText = newText;
        
        // 保存到撤销栈
        if (currentText !== newText) {
            undoStack.push(currentText);
            redoStack = [];
            if (undoStack.length > MAX_HISTORY) {
                undoStack.shift();
            }
            currentText = newText;
        }
        
        // 重新分析和绘制
        nodeIndexMap = new Map();
        analyzeGcode(newText);
        updateLineNumbers();
        drawGcode(newText);
        
        // 清除搜索高亮
        clearSearchHighlights();
        
        // 重新执行搜索
        performSearch(searchState.searchText);
        
        disableHighlight = false;
    } catch (e) {
        console.error('替换正则表达式错误:', e);
    }
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 添加快捷键支持
document.addEventListener('keydown', function(e) {
    // Ctrl+F 或 Cmd+F: 打开搜索面板
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchPanel = document.getElementById('search-panel');
        searchPanel.classList.remove('hidden');
        document.getElementById('search-input').focus();
    }
    
    // Escape: 关闭搜索面板
    if (e.key === 'Escape') {
        const searchPanel = document.getElementById('search-panel');
        if (!searchPanel.classList.contains('hidden')) {
            searchPanel.classList.add('hidden');
            clearSearchHighlights();
            searchState.isSearchActive = false;
            editor.focus();
        }
    }
    
    // F3 或 Enter(在搜索框中): 查找下一个
    if (e.key === 'F3' || 
        (e.key === 'Enter' && document.activeElement === document.getElementById('search-input'))) {
        e.preventDefault();
        if (searchState.matches.length > 0) {
            searchState.currentMatchIndex = (searchState.currentMatchIndex + 1) % searchState.matches.length;
            highlightCurrentMatch();
        }
    }
    
    // Shift+F3 或 Shift+Enter(在搜索框中): 查找上一个
    if ((e.key === 'F3' && e.shiftKey) || 
        (e.key === 'Enter' && e.shiftKey && document.activeElement === document.getElementById('search-input'))) {
        e.preventDefault();
        if (searchState.matches.length > 0) {
            searchState.currentMatchIndex = (searchState.currentMatchIndex - 1 + searchState.matches.length) % searchState.matches.length;
            highlightCurrentMatch();
        }
    }
    
    // Enter(在替换框中): 替换当前并查找下一个
    if (e.key === 'Enter' && document.activeElement === document.getElementById('replace-input')) {
        e.preventDefault();
        const replaceText = document.getElementById('replace-input').value;
        if (searchState.matches.length > 0 && searchState.currentMatchIndex >= 0) {
            replaceCurrentMatch(replaceText);
        }
    }
});

// 撤销操作函数
function performUndo() {
    if (undoStack.length === 0) return;
    
    // 标记为撤销/重做操作
    isUndoRedoAction = true;
    
    // 保存当前文本到重做栈
    redoStack.push(editor.innerText);
    
    // 获取上一个状态
    const previousText = undoStack.pop();
    
    // 更新编辑器内容
    editor.innerText = previousText;
    
    // 更新当前文本
    currentText = previousText;
    
    // 分析并更新节点编号
    nodeIndexMap = new Map();
    analyzeGcode(previousText);
    
    // 更新行号
    updateLineNumbers();
    
    // 更新高亮
    applyHighlighting();
    
    // 重绘G-code
    drawGcode(previousText);
    
    // 更新表格数据
    if (!isTableUpdating) {
        updateTableFromGcode();
    }
}

// 重做操作函数
function performRedo() {
    if (redoStack.length === 0) return;
    
    // 标记为撤销/重做操作
    isUndoRedoAction = true;
    
    // 保存当前文本到撤销栈
    undoStack.push(editor.innerText);
    
    // 获取下一个状态
    const nextText = redoStack.pop();
    
    // 更新编辑器内容
    editor.innerText = nextText;
    
    // 更新当前文本
    currentText = nextText;
    
    // 分析并更新节点编号
    nodeIndexMap = new Map();
    analyzeGcode(nextText);
    
    // 更新行号
    updateLineNumbers();
    
    // 更新高亮
    applyHighlighting();
    
    // 重绘G-code
    drawGcode(nextText);
    
    // 更新表格数据
    if (!isTableUpdating) {
        updateTableFromGcode();
    }
}

// 格式化G-code功能
document.getElementById('format-btn').addEventListener('click', function() {
    const formattedText = formatGcode(editor.innerText);
    
    // 保存到撤销栈
    if (currentText !== formattedText) {
        undoStack.push(currentText);
        redoStack = [];
        if (undoStack.length > MAX_HISTORY) {
            undoStack.shift();
        }
        currentText = formattedText;
    }
    
    // 更新编辑器内容
    disableHighlight = true;
    editor.innerText = formattedText;
    
    // 重新分析和绘制
    nodeIndexMap = new Map();
    analyzeGcode(formattedText);
    updateLineNumbers();
    drawGcode(formattedText);
    
    // 应用高亮
    applyHighlighting();
    
    // 如果搜索面板是打开的，重新执行搜索
    if (searchState && searchState.isSearchActive) {
        performSearch(searchState.searchText);
    }
    
    // 更新表格数据
    updateTableFromGcode();
});

// 格式化G-code的函数
function formatGcode(gcode) {
    const lines = gcode.split('\n');
    const formattedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // 跳过空行
        if (line === '') {
            formattedLines.push('');
            continue;
        }
        
        // 处理注释行
        if (line.startsWith(';')) {
            formattedLines.push(line);
            continue;
        }
        
        // 分离代码和注释
        let code = line;
        let comment = '';
        const commentIndex = line.indexOf(';');
        if (commentIndex !== -1) {
            code = line.substring(0, commentIndex).trim();
            comment = line.substring(commentIndex);
        }
        
        // 处理代码部分
        if (code) {
            const tokens = code.split(/\s+/);
            let formattedCode = '';
            
            // 处理第一个令牌（通常是G或M命令）
            if (tokens.length > 0) {
                const firstToken = tokens[0].toUpperCase();
                formattedCode = firstToken;
                
                // 处理其余令牌
                for (let j = 1; j < tokens.length; j++) {
                    let token = tokens[j].toUpperCase();
                    
                    // 确保坐标参数之间有空格
                    if (token.match(/^[XYZFES]/)) {
                        formattedCode += ' ' + token;
                    } else {
                        formattedCode += ' ' + token;
                    }
                }
            }
            
            // 组合代码和注释
            if (comment) {
                formattedLines.push(formattedCode + ' ' + comment);
            } else {
                formattedLines.push(formattedCode);
            }
        } else if (comment) {
            // 只有注释
            formattedLines.push(comment);
        }
    }
    
    return formattedLines.join('\n');
}

// 错误检查功能
document.getElementById('check-btn').addEventListener('click', function() {
    const errors = checkGcodeErrors(editor.innerText);
    showErrors(errors);
});

// 关闭错误面板
document.getElementById('close-error-panel').addEventListener('click', function() {
    document.getElementById('error-panel').classList.add('hidden');
    // 清除错误高亮
    clearErrorHighlights();
});

// 检查G-code错误的函数
function checkGcodeErrors(gcode) {
    const errors = [];
    
    // 检查重复节点
    const nodePositions = new Map(); // 用于存储节点位置
    const duplicateNodes = new Set(); // 用于存储重复节点
    
    // 解析G代码
    const lines = gcode.split('\n');
    let x = 0, y = 0, z = 0; // 当前坐标
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 跳过空行和纯注释行
        if (line === '' || line.startsWith(';')) continue;
        
        // 提取代码部分（去除注释）
        let codeLine = line;
        const commentIndex = line.indexOf(';');
        if (commentIndex !== -1) {
            codeLine = line.substring(0, commentIndex).trim();
        }
        
        if (codeLine === '') continue;
        
        const tokens = codeLine.trim().split(/\s+/);
        const command = tokens[0].toUpperCase();
        
        if (command === 'G0' || command === 'G1') {
            let newX = x, newY = y, newZ = z;
            let hasCoordinateChange = false;
            
            // 提取 X, Y, Z 坐标 (如果有)
            for (const token of tokens) {
                const upperToken = token.toUpperCase();
                if (upperToken.startsWith('X')) {
                    newX = parseFloat(upperToken.substring(1));
                    hasCoordinateChange = true;
                }
                if (upperToken.startsWith('Y')) {
                    newY = parseFloat(upperToken.substring(1));
                    hasCoordinateChange = true;
                }
                if (upperToken.startsWith('Z')) {
                    newZ = parseFloat(upperToken.substring(1));
                    hasCoordinateChange = true;
                }
            }
            
            // 如果坐标有变化，则检查是否有重复节点
            if (hasCoordinateChange) {
                const posKey = `${newX.toFixed(2)},${newY.toFixed(2)},${newZ.toFixed(2)}`;
                
                if (nodePositions.has(posKey)) {
                    // 发现重复节点
                    duplicateNodes.add(posKey);
                    
                    // 添加错误信息
                    errors.push({
                        lineIndex: i,
                        message: `${getText("error_duplicate_nodes")} (${posKey})`
                    });
                } else {
                    // 记录节点位置
                    nodePositions.set(posKey, i);
                }
                
                // 更新当前坐标
                x = newX;
                y = newY;
                z = newZ;
            }
        }
    }
    
    // 显示错误信息
    if (errors.length > 0) {
        showErrors(errors);
    } else {
        // 显示成功信息
        const errorList = document.getElementById('error-list');
        errorList.innerHTML = `<div class="success">${getText("error_no_errors")}</div>`;
        document.getElementById('error-panel').classList.remove('hidden');
        
        console.log(getText("error_check_complete"));
    }
}

// 显示错误的函数
function showErrors(errors) {
    const errorPanel = document.getElementById('error-panel');
    const errorList = document.getElementById('error-list');
    
    // 清空错误列表
    errorList.innerHTML = '';
    
    if (errors.length === 0) {
        // 没有错误
        errorList.innerHTML = '<div class="success-message">没有发现错误！</div>';
    } else {
        // 显示错误
        for (const error of errors) {
            const errorItem = document.createElement('div');
            errorItem.className = 'error-item';
            
            const lineSpan = document.createElement('span');
            lineSpan.className = 'error-line';
            lineSpan.textContent = `第 ${error.lineIndex + 1} 行:`;
            lineSpan.addEventListener('click', () => {
                // 高亮错误行
                highlightErrorLine(error.lineIndex);
                // 滚动到错误行
                scrollToLine(error.lineIndex);
            });
            
            const messageSpan = document.createElement('span');
            messageSpan.className = 'error-message';
            messageSpan.textContent = error.message;
            
            errorItem.appendChild(lineSpan);
            errorItem.appendChild(messageSpan);
            errorList.appendChild(errorItem);
        }
    }
    
    // 显示错误面板
    errorPanel.classList.remove('hidden');
}

// 高亮错误行
function highlightErrorLine(lineIndex) {
    // 清除之前的错误高亮
    clearErrorHighlights();
    
    // 获取编辑器文本
    const text = editor.innerText;
    const lines = text.split('\n');
    
    // 构建带有高亮的HTML
    let resultHtml = '';
    
    for (let i = 0; i < lines.length; i++) {
        if (i === lineIndex) {
            // 高亮错误行
            resultHtml += `<div class="error-highlight">${escapeHtml(lines[i])}</div>`;
        } else {
            resultHtml += escapeHtml(lines[i]);
            if (i < lines.length - 1) {
                resultHtml += '\n';
            }
        }
    }
    
    // 保存当前光标位置
    const cursorPosition = getCursorPosition(editor);
    
    // 更新编辑器内容
    disableHighlight = true;
    editor.innerHTML = resultHtml;
    disableHighlight = false;
    
    // 应用G-code高亮
    applyHighlighting();
    
    // 恢复光标位置
    setCursorPosition(editor, cursorPosition);
}

// 清除错误高亮
function clearErrorHighlights() {
    // 重新应用普通的G-code高亮
    applyHighlighting();
}

// 滚动到指定行
function scrollToLine(lineIndex) {
    const lines = editor.innerText.split('\n');
    let position = 0;
    
    // 计算目标行的位置
    for (let i = 0; i < lineIndex; i++) {
        position += lines[i].length + 1; // +1 是换行符
    }
    
    // 设置光标位置
    setCursorPosition(editor, position);
    
    // 滚动到可见区域
    const errorElement = editor.querySelector('.error-highlight');
    if (errorElement) {
        errorElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}

// 初始化表格
function initTable() {
    // 绑定表格按钮事件
    document.getElementById('update-table').addEventListener('click', updateTableFromGcode);
    document.getElementById('apply-table').addEventListener('click', applyTableToGcode);
    document.getElementById('add-row').addEventListener('click', addTableRow);
    document.getElementById('delete-row').addEventListener('click', deleteTableRow);
    
    // 添加表格键盘导航事件
    document.addEventListener('keydown', function(e) {
        // 检查是否在表格输入框内
        if (document.activeElement.tagName === 'INPUT' && 
            document.activeElement.closest('#gcode-table')) {
            
            const input = document.activeElement;
            const td = input.parentElement;
            const tr = td.parentElement;
            const rowIndex = parseInt(tr.dataset.index);
            const field = input.dataset.field;
            
            // Tab键导航
            if (e.key === 'Tab') {
                e.preventDefault();
                
                const inputs = Array.from(tr.querySelectorAll('input'));
                const currentIndex = inputs.indexOf(input);
                
                if (e.shiftKey) {
                    // Shift+Tab: 移动到上一个输入框
                    if (currentIndex > 0) {
                        // 同一行的上一个输入框
                        inputs[currentIndex - 1].focus();
                    } else if (rowIndex > 0) {
                        // 上一行的最后一个输入框
                        const prevRow = tr.previousElementSibling;
                        if (prevRow) {
                            const prevInputs = prevRow.querySelectorAll('input');
                            prevInputs[prevInputs.length - 1].focus();
                        }
                    }
                } else {
                    // Tab: 移动到下一个输入框
                    if (currentIndex < inputs.length - 1) {
                        // 同一行的下一个输入框
                        inputs[currentIndex + 1].focus();
                    } else if (rowIndex < tableData.length - 1) {
                        // 下一行的第一个输入框
                        const nextRow = tr.nextElementSibling;
                        if (nextRow) {
                            const nextInputs = nextRow.querySelectorAll('input');
                            nextInputs[0].focus();
                        }
                    }
                }
            }
        }
    });
    
    // 初始化表格数据
    updateTableFromGcode();
}

// 从G代码更新表格
function updateTableFromGcode() {
    // 如果是从表格更新G代码，则跳过更新表格
    if (isTableUpdating) return;
    
    const gcode = editor.innerText;
    tableData = [];
    
    // 解析G代码
    const lines = gcode.split('\n');
    let rowIndex = 0;
    let currentX = 0, currentY = 0, currentZ = 0, currentF = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 跳过空行和纯注释行
        if (line === '' || line.startsWith(';')) continue;
        
        // 提取代码部分（去除注释）
        let codeLine = line;
        const commentIndex = line.indexOf(';');
        if (commentIndex !== -1) {
            codeLine = line.substring(0, commentIndex).trim();
        }
        
        if (codeLine === '') continue;
        
        const tokens = codeLine.trim().split(/\s+/);
        const command = tokens[0].toUpperCase();
        
        // 只处理G0和G1命令
        if (command === 'G0' || command === 'G1') {
            let x = null, y = null, z = null, f = null;
            let hasCoordinateChange = false;
            
            // 提取坐标和进给速度
            for (const token of tokens) {
                const upperToken = token.toUpperCase();
                if (upperToken.startsWith('X')) {
                    x = parseFloat(upperToken.substring(1));
                    hasCoordinateChange = true;
                }
                if (upperToken.startsWith('Y')) {
                    y = parseFloat(upperToken.substring(1));
                    hasCoordinateChange = true;
                }
                if (upperToken.startsWith('Z')) {
                    z = parseFloat(upperToken.substring(1));
                    hasCoordinateChange = true;
                }
                if (upperToken.startsWith('F')) {
                    f = parseFloat(upperToken.substring(1));
                }
            }
            
            // 使用当前坐标填充未指定的坐标
            if (x === null) x = currentX;
            if (y === null) y = currentY;
            if (z === null) z = currentZ;
            
            // 只有坐标有变化时才添加到表格
            if (hasCoordinateChange) {
                // 添加到表格数据
                tableData.push({
                    index: rowIndex++,
                    lineNumber: i,
                    command: command,
                    x: x,
                    y: y,
                    z: z,
                    f: f
                });
                
                // 更新当前坐标
                currentX = x;
                currentY = y;
                currentZ = z;
                if (f !== null) currentF = f;
            }
        }
    }
    
    // 更新表格UI
    renderTable();
}

// 渲染表格
function renderTable() {
    const tbody = document.querySelector('#gcode-table tbody');
    tbody.innerHTML = '';
    
    // 更新表头
    const tableHeaders = document.querySelectorAll('#gcode-table th');
    tableHeaders.forEach(th => {
        if (th.hasAttribute('data-lang-' + currentLanguage)) {
            th.textContent = th.getAttribute('data-lang-' + currentLanguage);
        }
    });
    
    for (let i = 0; i < tableData.length; i++) {
        const row = tableData[i];
        const tr = document.createElement('tr');
        tr.dataset.index = i;
        
        // 添加序号单元格
        const tdIndex = document.createElement('td');
        tdIndex.textContent = row.index + 1;
        tr.appendChild(tdIndex);
        
        // 添加X坐标单元格
        const tdX = document.createElement('td');
        const inputX = document.createElement('input');
        inputX.type = 'text';
        inputX.value = row.x !== null ? row.x.toFixed(2) : '';
        inputX.dataset.field = 'x';
        inputX.addEventListener('change', (e) => updateTableCell(i, 'x', e.target.value));
        tdX.appendChild(inputX);
        tr.appendChild(tdX);
        
        // 添加Y坐标单元格
        const tdY = document.createElement('td');
        const inputY = document.createElement('input');
        inputY.type = 'text';
        inputY.value = row.y !== null ? row.y.toFixed(2) : '';
        inputY.dataset.field = 'y';
        inputY.addEventListener('change', (e) => updateTableCell(i, 'y', e.target.value));
        tdY.appendChild(inputY);
        tr.appendChild(tdY);
        
        // 添加Z坐标单元格
        const tdZ = document.createElement('td');
        const inputZ = document.createElement('input');
        inputZ.type = 'text';
        inputZ.value = row.z !== null ? row.z.toFixed(2) : '';
        inputZ.dataset.field = 'z';
        inputZ.addEventListener('change', (e) => updateTableCell(i, 'z', e.target.value));
        tdZ.appendChild(inputZ);
        tr.appendChild(tdZ);
        
        // 添加F进给速度单元格
        const tdF = document.createElement('td');
        const inputF = document.createElement('input');
        inputF.type = 'text';
        inputF.value = row.f !== null ? row.f.toFixed(0) : '';
        inputF.dataset.field = 'f';
        inputF.addEventListener('change', (e) => updateTableCell(i, 'f', e.target.value));
        tdF.appendChild(inputF);
        tr.appendChild(tdF);
        
        // 添加行点击事件
        tr.addEventListener('click', () => selectTableRow(i));
        
        // 如果是选中行，添加选中样式
        if (i === selectedRowIndex) {
            tr.classList.add('selected');
        }
        
        tbody.appendChild(tr);
    }
}

// 更新表格单元格
function updateTableCell(rowIndex, field, value) {
    if (rowIndex >= 0 && rowIndex < tableData.length) {
        // 转换为数字
        const numValue = value === '' ? null : parseFloat(value);
        
        // 更新表格数据
        tableData[rowIndex][field] = numValue;
        
        // 自动应用表格数据到G代码
        if (!isTableUpdating) {
            applyTableToGcode();
        }
    }
}

// 选择表格行
function selectTableRow(rowIndex) {
    // 更新选中行索引
    selectedRowIndex = rowIndex;
    
    // 更新表格UI
    const rows = document.querySelectorAll('#gcode-table tbody tr');
    rows.forEach(row => row.classList.remove('selected'));
    
    if (rowIndex >= 0 && rowIndex < rows.length) {
        rows[rowIndex].classList.add('selected');
        
        // 高亮对应的G代码行
        if (rowIndex >= 0 && rowIndex < tableData.length) {
            const lineNumber = tableData[rowIndex].lineNumber;
            if (lineNumber >= 0) {
                // 临时禁用处理标记，避免触发循环更新
                const wasProcessing = isProcessing;
                isProcessing = true;
                
                highlightGcodeLine(lineNumber);
                
                // 恢复处理标记
                setTimeout(() => {
                    isProcessing = wasProcessing;
                }, 50);
            }
        }
    }
}

// 添加表格行
function addTableRow() {
    // 获取最后一行的数据作为默认值
    let defaultX = 0, defaultY = 0, defaultZ = 0, defaultF = null;
    if (tableData.length > 0) {
        const lastRow = tableData[tableData.length - 1];
        defaultX = lastRow.x !== null ? lastRow.x : 0;
        defaultY = lastRow.y !== null ? lastRow.y : 0;
        defaultZ = lastRow.z !== null ? lastRow.z : 0;
        defaultF = lastRow.f;
    }
    
    // 添加新行
    tableData.push({
        index: tableData.length,
        lineNumber: -1, // 新行还没有对应的G代码行
        command: 'G1',
        x: defaultX,
        y: defaultY,
        z: defaultZ,
        f: defaultF
    });
    
    // 更新表格UI
    renderTable();
    
    // 选中新行
    selectTableRow(tableData.length - 1);
    
    // 自动应用表格数据到G代码
    if (!isTableUpdating) {
        applyTableToGcode();
    }
}

// 删除表格行
function deleteTableRow() {
    if (selectedRowIndex >= 0 && selectedRowIndex < tableData.length) {
        // 删除选中行
        tableData.splice(selectedRowIndex, 1);
        
        // 更新索引
        for (let i = 0; i < tableData.length; i++) {
            tableData[i].index = i;
        }
        
        // 更新选中行索引
        if (selectedRowIndex >= tableData.length) {
            selectedRowIndex = tableData.length - 1;
        }
        
        // 更新表格UI
        renderTable();
        
        // 自动应用表格数据到G代码
        if (!isTableUpdating) {
            applyTableToGcode();
        }
    }
}

// 将表格数据应用到G代码
function applyTableToGcode() {
    if (tableData.length === 0) return;
    
    // 标记为正在处理，防止循环更新
    isProcessing = true;
    isTableUpdating = true;
    
    try {
        // 获取当前G代码
        const lines = editor.innerText.split('\n');
        const newLines = [];
        
        // 保留注释和非G0/G1命令
        let hasG90 = false;
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // 检查是否是G0或G1命令
            let isG0G1 = false;
            if (!trimmedLine.startsWith(';')) {
                const codeLine = trimmedLine.split(';')[0].trim();
                const tokens = codeLine.split(/\s+/);
                if (tokens.length > 0) {
                    const command = tokens[0].toUpperCase();
                    if (command === 'G0' || command === 'G1') {
                        isG0G1 = true;
                    }
                }
            }
            
            // 保留非G0/G1命令和注释
            if (!isG0G1) {
                newLines.push(line);
                if (trimmedLine.startsWith('G90')) {
                    hasG90 = true;
                }
            }
        }
        
        // 如果没有G90命令，添加一个
        if (!hasG90) {
            newLines.push('G90 ; 绝对坐标模式');
        }
        
        // 添加表格数据生成的G代码
        for (const row of tableData) {
            let codeLine = row.command;
            
            if (row.x !== null) codeLine += ` X${row.x.toFixed(2)}`;
            if (row.y !== null) codeLine += ` Y${row.y.toFixed(2)}`;
            if (row.z !== null) codeLine += ` Z${row.z.toFixed(2)}`;
            if (row.f !== null) codeLine += ` F${row.f.toFixed(0)}`;
            
            newLines.push(codeLine);
        }
        
        // 更新编辑器内容
        editor.innerText = newLines.join('\n');
        
        // 触发输入事件，更新渲染
        const inputEvent = new Event('input', {
            bubbles: true,
            cancelable: true,
        });
        editor.dispatchEvent(inputEvent);
    } catch (error) {
        console.error(getText("error_applying_table"), error);
    } finally {
        // 重置处理标记
        setTimeout(() => {
            isProcessing = false;
            isTableUpdating = false;
        }, 100);
    }
}

// 初始化时执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化编辑器
    editor = document.getElementById('gcode-editor');
    editor.contentEditable = true;
    editor.spellcheck = false;
    
    // 初始化时添加一些示例G-code
    editor.innerHTML = `G90 ; 绝对坐标模式
G0 X0 Y0 Z5 ; 快速移动到起点上方
G1 Z0 ; 下降到工作平面
G1 X10 Y0 ; 直线移动
G1 X10 Y10
G1 X0 Y10
G1 X0 Y0 ; 回到起点
G0 Z5 ; 抬起工具`;

    // 初始化当前文本变量
    currentText = editor.innerText;

    // 初始化时执行一次分析
    nodeIndexMap = new Map();
    analyzeGcode(editor.innerText);

    // 初始化时更新行号
    updateLineNumbers();

    // 初始化时高亮代码
    applyHighlighting();

    // 初始化时绘图
    drawGcode(editor.innerText);
    
    // 初始化表格
    initTable();
    
    // 从localStorage加载语言设置
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && (savedLanguage === 'zh' || savedLanguage === 'en')) {
        currentLanguage = savedLanguage;
        switchLanguage(savedLanguage);
    }
    
    // 初始化语言切换按钮
    console.log('初始化语言切换按钮');
    const zhBtn = document.getElementById('lang-zh');
    const enBtn = document.getElementById('lang-en');
    
    if (zhBtn) {
        console.log('找到中文按钮');
        zhBtn.addEventListener('click', function() {
            console.log('点击了中文按钮');
            switchLanguage('zh');
        });
    } else {
        console.error('未找到中文按钮');
    }
    
    if (enBtn) {
        console.log('找到英文按钮');
        enBtn.addEventListener('click', function() {
            console.log('点击了英文按钮');
            switchLanguage('en');
        });
    } else {
        console.error('未找到英文按钮');
    }
    
    // 添加一个测试按钮，用于调试
    document.getElementById('check-btn').addEventListener('click', () => {
        console.log("节点映射大小:", nodeIndexMap.size);
        console.log("节点位置数组大小:", nodePositions.length);
        
        // 检查G-code错误
        checkGcodeErrors(editor.innerText);
    });
    
    // 绑定查找/替换按钮事件
    document.getElementById('search-toggle').addEventListener('click', function() {
        const searchPanel = document.getElementById('search-panel');
        searchPanel.classList.toggle('hidden');
        if (!searchPanel.classList.contains('hidden')) {
            document.getElementById('search-input').focus();
        } else {
            clearSearchHighlights();
        }
    });
    
    // 绑定格式化按钮事件
    document.getElementById('format-btn').addEventListener('click', function() {
        const formattedGcode = formatGcode(editor.innerText);
        editor.innerText = formattedGcode;
        
        // 触发输入事件，更新渲染
        const inputEvent = new Event('input', {
            bubbles: true,
            cancelable: true,
        });
        editor.dispatchEvent(inputEvent);
        
        // 更新表格数据
        if (!isTableUpdating) {
            updateTableFromGcode();
        }
    });
    
    // 绑定查找按钮事件
    document.getElementById('search-next').addEventListener('click', function() {
        const searchText = document.getElementById('search-input').value;
        if (searchText) {
            const caseSensitive = document.getElementById('case-sensitive').checked;
            const wholeWord = document.getElementById('whole-word').checked;
            currentSearchIndex = (currentSearchIndex + 1) % searchMatches.length;
            highlightCurrentMatch();
        }
    });
    
    document.getElementById('search-prev').addEventListener('click', function() {
        const searchText = document.getElementById('search-input').value;
        if (searchText) {
            const caseSensitive = document.getElementById('case-sensitive').checked;
            const wholeWord = document.getElementById('whole-word').checked;
            currentSearchIndex = (currentSearchIndex - 1 + searchMatches.length) % searchMatches.length;
            highlightCurrentMatch();
        }
    });
    
    // 绑定搜索输入事件
    document.getElementById('search-input').addEventListener('input', function() {
        const searchText = this.value;
        if (searchText) {
            performSearch(searchText);
        } else {
            clearSearchHighlights();
            updateSearchCount(0, 0);
        }
    });
    
    // 绑定替换按钮事件
    document.getElementById('replace-btn').addEventListener('click', function() {
        const replaceText = document.getElementById('replace-input').value;
        replaceCurrentMatch(replaceText);
    });
    
    document.getElementById('replace-all-btn').addEventListener('click', function() {
        const replaceText = document.getElementById('replace-input').value;
        replaceAllMatches(replaceText);
    });
    
    // 绑定搜索选项变更事件
    document.getElementById('case-sensitive').addEventListener('change', function() {
        const searchText = document.getElementById('search-input').value;
        if (searchText) {
            performSearch(searchText);
        }
    });
    
    document.getElementById('whole-word').addEventListener('change', function() {
        const searchText = document.getElementById('search-input').value;
        if (searchText) {
            performSearch(searchText);
        }
    });
    
    // 绑定关闭错误面板按钮事件
    document.getElementById('close-error-panel').addEventListener('click', function() {
        document.getElementById('error-panel').classList.add('hidden');
        
        // 清除错误高亮
        clearErrorHighlights();
    });
});

// 高亮G代码行
function highlightGcodeLine(lineNumber) {
    // 清除之前的高亮
    clearErrorHighlights();
    
    // 高亮指定行
    const lines = editor.querySelectorAll('div');
    if (lineNumber >= 0 && lineNumber < lines.length) {
        lines[lineNumber].classList.add('error-highlight');
        
        // 滚动到该行
        scrollToLine(lineNumber);
    }
}