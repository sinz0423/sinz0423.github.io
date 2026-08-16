#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_graph.py — 把 Obsidian 专业课仓库解析为网页图谱数据

输入:  D:\\保研\\专业课\\专业课 （Obsidian 仓库，frontmatter 标签 + [[wikilink]] 链接）
输出:  graph-data.js（与脚本同目录，声明 window.GRAPH_DATA）
运行:  python "E:\\Claude Code\\保研\\邮件\\personal-site\\build_graph.py"

纯标准库，无第三方依赖。
"""
import os
import re
import json
import collections

VAULT = r"D:\保研\专业课\专业课"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "graph-data.js")

EXCLUDE_DIRS = {".obsidian", ".claude", ".claudian", ".git", "node_modules"}
IMG_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp")

WIKILINK = re.compile(r"\[\[([^\]|]+?)(?:\|([^\]]*?))?\]\]")
TAG_ITEM = re.compile(r"^\s*-\s*(.+?)\s*$", re.M)
TAG_INLINE = re.compile(r"^tags:\s*\[(.*?)\]", re.M)


def iter_notes(root):
    """产出 (vault相对路径, 绝对路径)，路径用 / 分隔，跳过配置目录。"""
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            if fn.lower().endswith(".md"):
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, root).replace("\\", "/")
                yield rel, full


def read_frontmatter(text):
    """返回 frontmatter 中的 tags 列表。"""
    if not text.startswith("---"):
        return []
    end = text.find("\n---", 3)
    if end == -1:
        return []
    fm = text[3:end]
    tags = TAG_ITEM.findall(fm)
    for inline in TAG_INLINE.findall(fm):
        tags += [t.strip() for t in inline.split(",") if t.strip()]
    return tags


def clean_title(basename, aliases, ntype):
    """主笔记直接取课程名；知识注解优先用引用频率最高的别名，否则清洗文件名。"""
    if ntype != "主笔记" and aliases:
        return max(aliases, key=aliases.get)
    name = basename[:-3]  # 去掉 .md
    name = re.sub(r"^[\d\-.\s]+", "", name)  # 去掉 1. / 2-3. 等编号前缀
    name = re.sub(r"-知识$", "", name)
    return name or basename[:-3]


# ---- 1. 收集全部笔记 ----
notes = {}                 # id -> {id, file, course, type}
body_links = {}            # id -> [(raw_target, alias)]

for rel, full in iter_notes(VAULT):
    with open(full, encoding="utf-8-sig") as f:
        text = f.read()
    tags = read_frontmatter(text)
    course = next((t.split("/", 1)[1] for t in tags if t.startswith("课程/")), None)
    ntype = next((t.split("/", 1)[1] for t in tags if t.startswith("类型/")), None)
    nid = rel[:-3]
    notes[nid] = {"id": nid, "file": rel, "course": course or "其他", "type": ntype or "知识"}

    links = []
    for m in WIKILINK.finditer(text):
        if m.start() > 0 and text[m.start() - 1] == "!":  # 图片 embed ![[...]]
            continue
        raw = m.group(1).strip()
        if raw.lower().split("#", 1)[0].endswith(IMG_EXT):
            continue
        links.append((raw, (m.group(2) or "").strip()))
    body_links[nid] = links


# ---- 2. 解析链接目标 ----
def resolve(target):
    t = target.split("#", 1)[0].strip().replace("\\", "/").strip("/")
    t = t[:-3] if t.lower().endswith(".md") else t
    if t in notes:
        return t
    base = t.rsplit("/", 1)[-1]  # 无路径目标：按文件名匹配
    for nid in notes:
        if nid.rsplit("/", 1)[-1] == base:
            return nid
    return None


edges = set()
for src, targets in body_links.items():
    for raw, alias in targets:
        dst = resolve(raw)
        if dst is None or dst == src:
            continue
        edges.add(tuple(sorted((src, dst))))
links = [{"source": s, "target": t} for s, t in edges]


# ---- 3. 节点标题（知识注解用引用最频繁的别名）----
alias_count = collections.defaultdict(collections.Counter)
for src, targets in body_links.items():
    for raw, alias in targets:
        dst = resolve(raw)
        if dst is None or not alias:
            continue
        alias_count[dst][alias] += 1

degree = collections.Counter()
for l in links:
    degree[l["source"]] += 1
    degree[l["target"]] += 1

nodes = []
for nid, n in notes.items():
    if n["file"] == "CLAUDE.md":  # 仓库工作流文档，非课程笔记
        continue
    # 只保留有连接的知识点，主笔记即使孤立也保留（如 C 语言暂无注解）
    if degree.get(nid, 0) == 0 and n["type"] != "主笔记":
        continue
    nodes.append({
        "id": nid,
        "name": clean_title(n["file"].rsplit("/", 1)[-1], alias_count.get(nid, {}), n["type"]),
        "course": n["course"],
        "type": n["type"],
        "degree": degree.get(nid, 0),
    })


# ---- 4. 输出 ----
data = {"nodes": nodes, "links": links}
js = "/* 由 build_graph.py 从 Obsidian 仓库自动生成 —— 请勿手改 */\n"
js += "window.GRAPH_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
with open(OUT, "w", encoding="utf-8") as f:
    f.write(js)

courses = collections.Counter(n["course"] for n in nodes)
types = collections.Counter(n["type"] for n in nodes)
print(f"节点: {len(nodes)}  链接: {len(links)}")
print("类型:", dict(types))
print("科目分布:")
for c, cnt in courses.most_common():
    print(f"  {c}: {cnt}")
