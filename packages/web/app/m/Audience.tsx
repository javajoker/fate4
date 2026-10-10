"use client";

import { AUDIENCE_LABEL, AUDIENCE_NOTE, AUDIENCES, type Audience } from "@fate/core";

/**
 * 读者档切换。
 *
 * ## 为什么要摆在界面上，而不是藏进设置
 *
 * 因为换一档**看到的东西不一样** —— 普通读者档少掉了指向未来的时段。
 * 一个会改变你看到什么的开关，不该让人不知道它存在：那样少掉的那几条
 * 就成了无声的删减，而无声的删减正是这个项目到处在防的东西。
 *
 * ## 它不改变守卫
 *
 * 三档的措辞守卫完全相同。切到「命理师」不会让应用开始预告事件 ——
 * 它只是把本来就算出来的数和候选时段给出来。这句话写在界面上，
 * 不只写在代码注释里。
 */
export function AudiencePicker(
  { value, onChange }: { value: Audience; onChange: (a: Audience) => void },
) {
  return (
    <div className="m-card">
      <h3>你是以什么身份在看</h3>
      <div className="m-chips" style={{ marginTop: 10, marginBottom: 8 }}>
        {AUDIENCES.map((a) => (
          <button key={a} className={`m-chip${a === value ? " on" : ""}`}
            onClick={() => onChange(a)}>
            {AUDIENCE_LABEL[a]}
          </button>
        ))}
      </div>
      <p className="dim">{AUDIENCE_NOTE[value]}</p>
      <p className="dim" style={{ marginTop: 8 }}>
        这个开关只决定<strong>给你看多少</strong>，不决定这套东西<strong>能说什么</strong>——
        三档的措辞检查完全一样。换到后两档不会让它开始预告事件，
        只是把本来就算出来的数和候选时段给出来。
      </p>
    </div>
  );
}

/**
 * 盘的来历警告。
 *
 * ⚠️ 这些警告此前在网页与移动版里**一次都没有显示过** —— 只有 Markdown
 * 导出与命令行有。而其中一条是「出生于晚子时，日柱已进位」：
 * 它意味着日柱换了一个，而日干就是日主，整张盘的基准点。
 * 读者不知道它，就不知道自己看的是三张盘里的哪一张。
 *
 * 故它**不受读者档影响**，任何档都出。
 */
export function ProvenanceWarnings({ warnings }: { warnings: readonly string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="m-card">
      <h3>这张盘是怎么定下来的</h3>
      <p className="dim">
        下面几条影响的是盘本身，不是对盘的解读 —— 换一条规则，盘就不是这一张了。
      </p>
      <ul className="m-list">
        {warnings.map((w, i) => <li key={i}>{w}</li>)}
      </ul>
    </div>
  );
}
