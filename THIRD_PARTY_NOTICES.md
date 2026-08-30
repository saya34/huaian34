# Third-party design reference

## DevilutionX

- Project: <https://github.com/diasurgical/DevilutionX>
- Reference revision: `1bb39d680b887fcf52fe7b50db5f73888101ed20`
- License found in the referenced repository: Sustainable Use License 1.0 (`LICENSE.md`)
- Reference date: 2026-08-31

《槐安一梦》重新实现了本项目指定的物品栏、仓库、装备校验、装备替换事务、随机词缀、物品估值与鉴定规则。实现语言、数据结构、界面与仙侠数值均已重写，没有直接复制 DevilutionX 的 C++ 源文件。

主要保留的行为语义包括：10×4 / 40 格行囊、多格物品碰撞检查、至多一件物品交换、按高宽整理、自动寻找空位、双手武器占据双手、装备替换前预留旧装备空间、属性要求失效、未鉴定词缀不生效，以及带前后缀的掉落生成。

本仓库的分发和商业使用仍须分别审查自身素材许可及上述参考项目的 Sustainable Use License 条款。
