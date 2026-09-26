"use client";

// 原生单选组提供键盘选择和明确的选中态；不额外重复“已选择”提示。
import { useState } from "react";
import { demoIdentities, demoRoles, type DemoRole } from "@/lib/demo-identity";
export function IdentityFields({ initialRole }: { initialRole: DemoRole }) {
  const [role, setRole] = useState(initialRole);
  return <fieldset className="identity-fields">
    <legend className="sr-only">演示身份</legend>
    {demoRoles.map((value) => <label key={value} className={"identity-option" + (role === value ? " is-selected" : "")}>
      <span className="identity-choice"><input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} /><span>{demoIdentities[value].label}</span></span>
      <span className="identity-description">{demoIdentities[value].description}</span>
    </label>)}
  </fieldset>;
}
