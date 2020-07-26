import { CreateAccountSuccess, LoginSuccess } from '../services/results/user.result';
import { ServiceError, ServiceErrors, ServiceResult } from '../services/_parent.service';
import errors, { Error } from '../errors/index';

import { CreateProjectSuccess } from '../services/results/project.result';
import FeatureRequestService from '../services/featurerequest.service';
import ProjectCategoryEntity from '../models/entities/projectcategory.entity';
import ProjectCategoryService from '../services/projectcategory.service';
import ProjectEntity from '../models/entities/project.entity';
import ProjectService from '../services/project.service';
import UserService from '../services/user.service';
import config from '../utils/config.util';
import express from 'express';
import fs from 'fs';
import mailerUtil from '../utils/mailer.util';
import { v4 as uuidv4 } from 'uuid';

export const home = (req: express.Request, res: express.Response) => {
  return res.render('pages/home.njk');
};

export const ressources = (req: express.Request, res: express.Response) => {
  return res.render('pages/apprentissage.njk');
};

export const comment = async (req: express.Request, res: express.Response) => {
  const service = new FeatureRequestService(res.locals.modelContext);
  let success = false;
  if (req.body && req.body.message && req.body.csrf && req.session) {
    if (req.session.csrf === req.body.csrf) {
      await service.create(req.body.message, res.locals.user); // ! TODO catch error maybe
    }
    success = true;
  }
  const comments = (await service.findAll()).map((com: any) => {
    com.publishedAt = com.publishedAt.toLocaleString('fr-FR', { timeZone: 'UTC' });
    return com;
  });
  return res.locals.renderWithUser('pages/commentaires.njk', { comments, success });
};

export const connexion = async (req: express.Request, res: express.Response) => {
  let error: Error | null = null;
  // Check if it's a POST
  if (req.body && req.body.email && req.body.password && req.body.csrf && req.session) {
    if (req.session.csrf === req.body.csrf) {
      const serviceResult = await new UserService(res.locals.modelContext).login(req.body.email, req.body.password); // Call the service
      if (serviceResult.status === 'error') {
        const result = serviceResult as ServiceResult<ServiceError>;
        error = { code: result.data.code, info: result.data.info };
      } else {
        const result = serviceResult as ServiceResult<LoginSuccess>;
        if (req.session) req.session.user = result.data.user; // Set the session
        return res.redirect('/'); // Redirect the user to home page
      }
    }
  }
  return res.render('pages/connexion.njk', { error });
};

export const inscription = async (req: express.Request, res: express.Response) => {
  let resErrors: Error[] = [];
  // Check if it's a POST
  if (
    req.body &&
    req.body.pseudo &&
    req.body.email &&
    req.body.password &&
    req.body.password_confirm &&
    req.body.csrf &&
    req.session
  ) {
    if (req.body.csrf === req.session.csrf) {
      if (req.body.password === req.body.password_confirm) {
        const serviceResult = await new UserService(res.locals.modelContext).createAccount(
          req.body.pseudo,
          req.body.email,
          req.body.password,
        ); // Call the service
        if (serviceResult.status === 'error') {
          const result = serviceResult as ServiceResult<ServiceErrors>;
          resErrors = result.data.errors;
        } else {
          const result = serviceResult as ServiceResult<CreateAccountSuccess>;
          if (req.session) req.session.user = result.data.user; // Set the session
          return res.redirect('/'); // Redirect the user to home page
        }
      } else {
        resErrors.push(errors.user.ConfirmPasswordNotMatch);
      }
    }
  }
  const errorCodes: any = resErrors.reduce((prev: any, e) => {
    prev[e.code] = true;
    return prev;
  }, {});
  return res.render('pages/inscription.njk', { errorCodes, errors: resErrors });
};

export const category = async (req: express.Request, res: express.Response) => {
  const cat = await ProjectCategoryEntity.findOne(res.locals.modelContext)
    .where('slug', '=', req.params.categorySlug)
    .exec();
  if (!cat) return res.redirect('/');

  let level: string | null = req.query.level as string;
  if (level && !['1', '2', '3'].includes(level)) {
    level = null;
  }

  let page = req.query.page && typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
  const nb = await new ProjectService(res.locals.modelContext).getProjectCount(cat, level);
  if ((page - 1) * 5 > nb) {
    page = 1;
  }
  const { projects, work } = await new ProjectService(res.locals.modelContext).findByCategory(cat, page, level);

  return res.render('pages/category.njk', { projects, work, nb, page, category: cat });
};

export const project = async (req: express.Request, res: express.Response) => {
  const proj = await ProjectEntity.findById(req.params.projectId, res.locals.modelContext);
  if (!proj) return res.redirect('/');
  return res.render('pages/projet.njk', { project: proj });
};

export const upload = async (req: express.Request, res: express.Response) => {
  let resErrors: Error[] = [];
  if (
    req.body &&
    req.body.name &&
    req.body.level &&
    req.body.category &&
    req.body.type &&
    req.body.description &&
    req.body.csrf &&
    req.session
  ) {
    if (req.session.csrf === req.body.csrf) {
      const picturePath = req.file
        ? `${uuidv4()}${req.file.originalname.substring(req.file.originalname.lastIndexOf('.'))}`
        : '';
      const serviceResult = await new ProjectService(res.locals.modelContext).create(
        req.body.name,
        req.body.level,
        req.body.category,
        req.body.type,
        req.body.description,
        picturePath,
        req.body.designlink || '',
        req.body.codesandboxlink || '',
        req.body.githublink || '',
        res.locals.user,
      );
      if (serviceResult.status === 'error') {
        const resu = serviceResult as ServiceResult<ServiceErrors>;
        resErrors = resu.data.errors;
      } else {
        const resu = serviceResult as ServiceResult<CreateProjectSuccess>;
        if (req.file) {
          fs.copyFileSync(req.file.path, `assets/upload/project/${picturePath}`);
          fs.unlinkSync(req.file.path);
        }
        return res.redirect(`/upload/${resu.data.project.id}`);
      }
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
    }
  }
  const projectCategories = (await new ProjectCategoryService(res.locals.modelContext).getAll()).data.categories;
  const errorCodes: any = resErrors.reduce((prev: any, e) => {
    prev[e.code] = true;
    return prev;
  }, {});
  return res.render('pages/upload.njk', { projectCategories, errorCodes, errors: resErrors });
};

export const uploadPublish = async (req: express.Request, res: express.Response) => {
  const proj: ProjectEntity | null = await ProjectEntity.findById(req.params.projectId, res.locals.modelContext);
  if (!proj) return res.redirect('/');
  if (proj.author.id !== res.locals.user.id) return res.redirect('/');
  if (proj.isPublished) return res.redirect('/');
  let resErrors: Error[] = [];
  if (req.body && req.body.rules && req.body.csrf && req.session) {
    if (req.body.csrf === req.session.csrf) {
      const serviceResult = await new ProjectService(res.locals.modelContext).publish(req.body.rules, proj);
      if (serviceResult.status === 'error') {
        const resu = serviceResult as ServiceResult<ServiceError>;
        resErrors = [resu.data];
      } else {
        return res.redirect(`/project/${proj.id}`);
      }
    }
  }
  const errorCodes: any = resErrors.reduce((prev: any, e) => (prev[e.code] = true), {});
  return res.render('pages/upload2.njk', { errorCodes, errors: resErrors });
};

export const releases = (req: express.Request, res: express.Response) => {
  return res.render('pages/releases.njk');
};

export const logout = (req: express.Request, res: express.Response) => {
  if (req.session) {
    req.session.user = undefined;
  }
  return res.redirect('/');
};

export const contact = async (req: express.Request, res: express.Response) => {
  let success = false;
  if (req.body && req.body.pseudo && req.body.email && req.body.message && req.body.csrf && req.session) {
    if (req.session.csrf === req.body.csrf) {
      await mailerUtil.sendMail(
        config.mail.contact,
        '[Made Contact] nouveau message',
        `${req.body.pseudo} (${req.body.email}) à envoyé un message via le formaulaire de contact de made. Voici son message: ${req.body.message}`,
      );
      success = true;
    }
  }
  return res.redirect('/');
};

export const categories = async (req: express.Request, res: express.Response) => {
  const projectCategories = (await new ProjectCategoryService(res.locals.modelContext).getAll()).data.categories;
  return res.render('pages/categories.njk', { projectCategories });
};

export const confidentialite = async (req: express.Request, res: express.Response) => {
  return res.render('pages/confidentialite.njk');
};
