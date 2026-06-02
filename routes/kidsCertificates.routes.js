const express =
  require("express");

const router =
  express.Router();

const pool =
  require("../config/db");

const {
  verifyToken
} = require(
  "../middleware/auth.middleware"
);

const puppeteer =
  require("puppeteer");

const chromium =
  require("@sparticuz/chromium");

console.log(
  "✅ kidsCertificates routes loaded"
);

router.get(
  "/my-certificates",
  verifyToken,
  async (req,res) => {

    const childId =
      Number(
        req.query.child_id
      );

    const result =
      await pool.query(
        `
        SELECT

          kc.certificate_id,

          kc.issued_at,

          c.title
            AS course_title

        FROM kids_certificates kc

        JOIN kids_courses c

        ON c.id = kc.course_id

        WHERE kc.child_id = $1

        ORDER BY kc.id DESC
        `,
        [childId]
      );

console.log(
  "CERTIFICATE REQUEST",
  childId
);

console.log(
  "CERTIFICATES FOUND",
  result.rows
);

    res.json({

      success:true,

      certificates:
        result.rows

    });

  }
);

router.get(
  "/:certificateId",

  async (req,res) => {

    try {

      const certId =
        req.params.certificateId;

      const result =
        await pool.query(
          `
          SELECT

            kc.*,

            kp.child_name,

            c.title
              AS course_title

          FROM kids_certificates kc

          JOIN kids_profiles kp

          ON kp.id = kc.child_id

          JOIN kids_courses c

          ON c.id = kc.course_id

          WHERE
          kc.certificate_id = $1
          `,
          [certId]
        );

      if (
        !result.rows.length
      ) {

        return res.status(404)
        .json({

          success:false

        });

      }

      return res.json({

        success:true,

        certificate:
          result.rows[0]

      });

    }

    catch(err) {

      console.error(err);

      return res.status(500)
      .json({

        success:false

      });

    }

  }
);



router.get(
  "/download/:certificateId",

  async (req, res) => {

    const certificateId =
      req.params.certificateId;

    try {

      const browser =
        await puppeteer.launch({

          args:
            chromium.args,

          defaultViewport:
            chromium.defaultViewport,

          executablePath:
            await chromium.executablePath(),

          headless:
            chromium.headless

        });

      const page =
        await browser.newPage();

      const frontendUrl =

        process.env.FRONTEND_URL ||

        "https://vaibhly-frontend.pages.dev";

      const url =

        `${frontendUrl}/kids-certificate.html?id=${certificateId}`;

      await page.goto(
        url,
        {
          waitUntil: "load",
          timeout: 60000
        }
      );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            1500
          )
      );

      await page.emulateMediaType(
        "print"
      );

      const pdfBuffer =
await page.pdf({

  width: "11in",

  height: "8.5in",

  landscape: true,

  printBackground: true,

  preferCSSPageSize: true,

  margin: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  }

});

      await browser.close();

      res.set({

        "Content-Type":
          "application/pdf",

        "Content-Disposition":

          `attachment; filename="certificate-${certificateId}.pdf"`,

        "Content-Length":
          pdfBuffer.length

      });

      return res.end(
        pdfBuffer
      );

    }

    catch (err) {

      console.error(
        "KIDS PDF ERROR:",
        err
      );

      return res.status(500)
      .json({

        success: false,

        message:
          err.message

      });

    }

  }
);


module.exports = router;