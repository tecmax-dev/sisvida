import fs from 'fs';

function fixUnionMember() {
    const path = 'src/pages/union/UnionMemberDetailPage.tsx';
    let content = fs.readFileSync(path, 'utf8');
    // Find the last actual code before the mess at the end
    const marker = 'MemberFiliacaoActionsDialog';
    const lastValidIndex = content.lastIndexOf(marker);
    if (lastValidIndex === -1) return;
    
    // Find the end of that component's closing tag
    const componentEnd = content.indexOf('/>', lastValidIndex);
    const ifEnd = content.indexOf(')}', componentEnd);
    
    let newContent = content.substring(0, ifEnd + 2);
    newContent += '\n      </div>\n    </div>\n  );\n}\n';
    fs.writeFileSync(path, newContent);
}

function fixEmployerDetail() {
    const path = 'src/pages/dashboard/EmployerDetailPage.tsx';
    let content = fs.readFileSync(path, 'utf8');
    const marker = 'NewNegotiationDialog';
    const lastValidIndex = content.lastIndexOf(marker);
    if (lastValidIndex === -1) return;
    
    const componentEnd = content.indexOf('/>', lastValidIndex);
    
    let newContent = content.substring(0, componentEnd + 2);
    newContent += '\n        </Tabs>\n      </div>\n    </div>\n  );\n}\n';
    fs.writeFileSync(path, newContent);
}

fixUnionMember();
fixEmployerDetail();
