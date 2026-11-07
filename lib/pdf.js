import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

const PAPER = process.env.PAPER || 'A4';
const INK = '#1b1b2f';
const MUTED = '#666677';

// Writes one ballot page per voter into a single PDF stream.
export async function writeBallots(stream, election, voters, baseUrl) {
  const doc = new PDFDocument({ size: PAPER, margin: 40, info: { Title: `${election.title} – Ballots` } });
  doc.pipe(stream);

  for (const [i, voter] of voters.entries()) {
    if (i > 0) doc.addPage();
    const qr = await QRCode.toBuffer(`${baseUrl}/checkin/${voter.token}`, { margin: 1, width: 300 });
    drawBallot(doc, election, voter, qr);
  }
  doc.end();
}

function drawBallot(doc, election, voter, qr) {
  const { width, height } = doc.page;
  const left = 40;
  const inner = width - 80;

  // ---- Header -------------------------------------------------------------
  doc.rect(left, 40, inner, 70).fill(INK);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(26)
    .text('OFFICIAL BALLOT', left, 52, { width: inner, align: 'center' });
  doc.font('Helvetica').fontSize(13)
    .text(`${election.title}  •  ${formatDate(election.date)}`, left, 84, { width: inner, align: 'center' });

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(12)
    .text('How to vote:', left, 128, { continued: true })
    .font('Helvetica').text('  Colour in ONE circle next to the party you choose. Then fold your ballot and put it in the ballot box!');

  // ---- Parties ------------------------------------------------------------
  const stubTop = height - 200;
  const listTop = 168;
  const rowGap = 10;
  const rowH = Math.min(110, (stubTop - 30 - listTop) / election.parties.length - rowGap);
  let y = listTop;

  for (const p of election.parties) {
    doc.lineWidth(1.5).roundedRect(left, y, inner, rowH, 10).strokeColor('#c8c8d8').stroke();
    doc.rect(left, y + 6, 6, rowH - 12).fill(p.color);

    const cy = y + rowH / 2;
    // The circle to colour in.
    doc.lineWidth(3).circle(left + 42, cy, 17).strokeColor(INK).stroke();

    // Party logo.
    const logoR = Math.min(28, rowH / 2 - 8);
    doc.circle(left + 104, cy, logoR).fill(p.color);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(logoR * 0.8)
      .text(p.initials, left + 104 - logoR, cy - logoR * 0.38, { width: logoR * 2, align: 'center' });

    // Text.
    const tx = left + 150;
    const tw = inner - 160;
    const showPromises = rowH >= 90;
    const compact = rowH < 64;
    let ty = cy - (showPromises ? 38 : compact ? 15 : 22);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(compact ? 15 : 17).text(p.name, tx, ty, { width: tw, lineBreak: false });
    ty += compact ? 18 : 22;
    if (!compact) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(11).text(`Led by ${p.leader}`, tx, ty, { width: tw });
      ty += 15;
    }
    doc.fillColor(p.color).font('Helvetica-BoldOblique').fontSize(12).text(`"${p.slogan}"`, tx, ty, { width: tw });
    if (showPromises) {
      ty += 17;
      doc.fillColor(MUTED).font('Helvetica').fontSize(10)
        .text(`We promise: ${p.promises.join(' • ')}`, tx, ty, { width: tw });
    }
    y += rowH + rowGap;
  }

  // ---- Tear-off line --------------------------------------------------------
  const cutY = stubTop - 14;
  doc.lineWidth(1).dash(6, { space: 5 }).moveTo(left, cutY).lineTo(width - left, cutY).strokeColor('#999').stroke().undash();
  doc.rect(width / 2 - 80, cutY - 7, 160, 14).fill('#ffffff');
  doc.fillColor('#999').font('Helvetica').fontSize(9)
    .text('cut or tear along this line', width / 2 - 80, cutY - 4, { width: 160, align: 'center' });

  // ---- Voter stub (has the QR, kept separate so the ballot stays secret) ----
  const sy = stubTop + 4;
  doc.lineWidth(2).roundedRect(left, sy, inner, 150, 12).strokeColor(INK).stroke();
  doc.image(qr, width - left - 140, sy + 8, { width: 134 });

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text('VOTER STUB', left + 18, sy + 16);
  doc.font('Helvetica').fontSize(10).fillColor(MUTED)
    .text('Give this part to the poll worker. They scan the QR code to show you voted.', left + 18, sy + 36, { width: inner - 190 });
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text(voter.name, left + 18, sy + 70, { width: inner - 190 });
  doc.font('Helvetica').fontSize(12).fillColor(MUTED)
    .text([voter.class_name && `Class: ${voter.class_name}`, `Voter #${String(voter.id).padStart(3, '0')}`]
      .filter(Boolean).join('     '), left + 18, sy + 98);
  doc.fontSize(9).text('Your vote is secret! The stub has your name, the ballot does not.', left + 18, sy + 124, { width: inner - 190 });
}

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
