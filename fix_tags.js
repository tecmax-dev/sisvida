import fs from 'fs';

function fixFile(filePath, openTags) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Remove the trailing garbage lines (empty lines or orphaned braces)
    const lines = content.split('\n');
    let lastValidLine = lines.length - 1;
    while (lastValidLine >= 0 && (lines[lastValidLine].trim() === '' || lines[lastValidLine].trim() === '}' || lines[lastValidLine].trim() === ');' || lines[lastValidLine].trim() === '}')) {
        lastValidLine--;
    }
    
    // We want to keep the closing tags we actually need.
    // For UnionMemberDetailPage: </div> (inner), </div> (outer), );, }
    // For EmployerDetailPage: </Tabs>, </div> (inner), </div> (outer), );, }
    
    let newContent = lines.slice(0, lastValidLine + 1).join('\n');
    newContent += '\n';
    openTags.forEach(tag => {
        newContent += tag + '\n';
    });
    newContent += '  );\n}\n';
    
    fs.writeFileSync(filePath, newContent);
}

fixFile('src/pages/union/UnionMemberDetailPage.tsx', ['      </div>', '    </div>']);
fixFile('src/pages/dashboard/EmployerDetailPage.tsx', ['        </Tabs>', '      </div>', '    </div>']);
